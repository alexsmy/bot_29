// static/js/main.js

import * as ui from './call_ui_elements.js';
import { initializeWebSocket, sendMessage, setGracefulDisconnect } from './call_websocket.js';
import * as webrtc from './call_webrtc.js';
import * as media from './call_media.js';
import * as monitor from './call_connection_monitor.js';
import * as uiManager from './call_ui_manager.js';

const tg = window.Telegram.WebApp;

let currentUser = {};
let targetUser = {};
let currentCallType = 'audio';
let lifetimeTimerInterval;
let isSpeakerMuted = false;
let isMuted = false;
let isVideoEnabled = true;
let isSpectator = false;
let roomId = '';
let rtcConfig = null;
let videoDevices = [];
let audioInDevices = [];
let audioOutDevices = [];
let selectedVideoId = null;
let selectedAudioInId = null;
let selectedAudioOutId = null;
let iceServerDetails = {};
let isCallInitiator = false;
let isEndingCall = false;


/**
 * Проверяет, является ли текущее устройство устройством на базе iOS.
 * @returns {boolean}
 */
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function sendLogToServer(message) {
    if (!currentUser || !currentUser.id || !roomId) return;
    fetch('/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: String(currentUser.id || 'pre-id'),
            room_id: String(roomId),
            message: message
        })
    }).catch(error => console.error('Failed to send log to server:', error));
}

function logToScreen(message) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const logMessage = `[${time}] ${message}`;
    console.log(logMessage);
    sendLogToServer(logMessage);
}

document.addEventListener('DOMContentLoaded', async () => {
    uiManager.loadIcons();
    const path = window.location.pathname;
    logToScreen(`App loaded. Path: ${path}`);

    try {
        logToScreen("Fetching ICE servers configuration from server...");
        const response = await fetch('/api/ice-servers');
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }
        const servers = await response.json();
        
        const peerConnectionConfig = servers.map(s => ({
            urls: s.urls,
            username: s.username,
            credential: s.credential
        }));
        rtcConfig = { iceServers: peerConnectionConfig, iceCandidatePoolSize: 10 };

        servers.forEach(s => {
            let provider = 'Unknown';
            if (s.source) {
                try {
                    provider = new URL(s.source).hostname.replace(/^www\./, '');
                } catch (e) { provider = s.source; }
            } else if (s.provider) {
                provider = s.provider;
            }
            iceServerDetails[s.urls] = {
                region: s.region || 'global',
                provider: provider
            };
        });

        logToScreen("ICE servers configuration and details loaded successfully.");
    } catch (error) {
        logToScreen(`[CRITICAL] Failed to fetch ICE servers: ${error.message}. Falling back to public STUN.`);
        alert("Не удалось загрузить конфигурацию сети. Качество звонка может быть низким.");
        rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        };
    }

    if (path.startsWith('/call/')) {
        const parts = path.split('/');
        roomId = parts[2];
        initializePrivateCallMode();
    } else {
        document.body.innerHTML = "<h1>Неверный URL</h1>";
    }
});

function initializePrivateCallMode() {
    logToScreen(`Initializing in Private Call mode for room: ${roomId}`);
    
    media.init(logToScreen);

    monitor.init({
        log: logToScreen,
        getPeerConnection: webrtc.getPeerConnection,
        updateConnectionIcon: uiManager.updateConnectionIcon,
        updateConnectionQualityIcon: uiManager.updateConnectionQualityIcon,
        showConnectionToast: uiManager.showConnectionToast,
        getIceServerDetails: () => iceServerDetails,
        getRtcConfig: () => rtcConfig
    });
    
    uiManager.init({ monitor });

    const webrtcCallbacks = {
        log: logToScreen,
        onCallConnected: () => {
            if (!ui.callScreen.classList.contains('active')) {
                uiManager.showScreen('call');
                uiManager.updateCallUI(currentCallType, targetUser, media.getMediaAccessStatus(), isMobileDevice());
            }
            uiManager.startTimer(currentCallType);
            ui.connectAudio.play();
        },
        onCallEndedByPeer: (reason) => endCall(false, reason),
        onRemoteTrack: (stream) => media.visualizeRemoteMic(stream),
        onRemoteMuteStatus: (isMuted) => {
            uiManager.showRemoteMuteToast(isMuted);
            logToScreen(`[REMOTE_STATUS] Peer is now ${isMuted ? 'muted' : 'unmuted'}.`);
        },
        getTargetUser: () => targetUser,
        getSelectedAudioOutId: () => selectedAudioOutId,
        getCurrentConnectionType: monitor.getCurrentConnectionType,
        isVideoEnabled: () => isVideoEnabled,
    };
    webrtc.init(webrtcCallbacks);

    setupEventListeners();
    runPreCallCheck();
}

async function runPreCallCheck() {
    uiManager.showScreen('pre-call-check');

    const iosNote = document.getElementById('ios-audio-permission-note');
    if (isIOS()) {
        iosNote.style.display = 'block';
    }
    
    const { hasCameraAccess, hasMicrophoneAccess } = await media.initializePreview(ui.previewVideo, ui.micLevelBars);

    if (!hasCameraAccess || !hasMicrophoneAccess) {
        displayMediaErrors({ name: 'NotFoundError' }); // Simplified error display
        ui.continueSpectatorBtn.style.display = 'block';
    }

    updateStatusIndicators(hasCameraAccess, hasMicrophoneAccess);

    if (hasCameraAccess || hasMicrophoneAccess) {
        const selectedIds = await media.populateDeviceSelectors(
            ui.cameraSelect, ui.micSelect, ui.speakerSelect,
            ui.cameraSelectContainer, ui.micSelectContainer, ui.speakerSelectContainer
        );
        selectedVideoId = selectedIds.videoId;
        selectedAudioInId = selectedIds.audioInId;
        selectedAudioOutId = selectedIds.audioOutId;
        ui.continueToCallBtn.disabled = false;
    } else {
        logToScreen('[MEDIA_CHECK] No media devices available or access denied to all.');
    }
}

function updateStatusIndicators(hasCamera, hasMic) {
    ui.cameraStatus.classList.toggle('status-ok', hasCamera);
    ui.cameraStatus.classList.toggle('status-error', !hasCamera);
    ui.cameraStatusText.textContent = `Камера: ${hasCamera ? 'OK' : 'Нет доступа'}`;

    ui.micStatus.classList.toggle('status-ok', hasMic);
    ui.micStatus.classList.toggle('status-error', !hasMic);
    ui.micStatusText.textContent = `Микрофон: ${hasMic ? 'OK' : 'Нет доступа'}`;
}

function displayMediaErrors(error) {
    let message = 'Не удалось получить доступ к камере и/или микрофону. ';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message += 'Вы заблокировали доступ. Пожалуйста, измените разрешения в настройках браузера.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        message += 'Устройства не найдены. Убедитесь, что они подключены и работают.';
    } else {
        message += 'Произошла ошибка. Попробуйте перезагрузить страницу.';
    }

    console.error(message);
}

async function updatePreviewStream() {
    selectedVideoId = ui.cameraSelect.value;
    selectedAudioInId = ui.micSelect.value;
    selectedAudioOutId = ui.speakerSelect.value;
    
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();

    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
        video: hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
    };

    await media.updatePreviewStream(constraints, ui.previewVideo, ui.micLevelBars);
}

function proceedToCall(asSpectator = false) {
    isSpectator = asSpectator;
    logToScreen(`Proceeding to call screen. Spectator mode: ${isSpectator}`);
    media.stopPreviewStream();

    uiManager.showScreen('pre-call');
    uiManager.showPopup('waiting');
    
    const wsHandlers = {
        onIdentity: (data) => {
            currentUser.id = data.id;
            logToScreen(`[WS] Identity assigned by server: ${currentUser.id}`);
        },
        onUserList: handleUserList,
        onIncomingCall: handleIncomingCall,
        onCallAccepted: () => {
            ui.ringOutAudio.pause(); 
            ui.ringOutAudio.currentTime = 0;
            const localStream = media.getLocalStream();
            webrtc.startPeerConnection(targetUser.id, true, currentCallType, localStream, rtcConfig, monitor.connectionLogger);
        },
        onOffer: (data) => {
            const localStream = media.getLocalStream();
            webrtc.handleOffer(data, localStream, rtcConfig, monitor.connectionLogger);
        },
        onAnswer: webrtc.handleAnswer,
        onCandidate: webrtc.handleCandidate,
        onCallEnded: () => endCall(false, 'ended_by_peer'),
        onCallMissed: () => {
            alert("Абонент не отвечает.");
            endCall(false, 'no_answer');
        },
        onRoomClosed: () => {
            alert("Комната для звонков была закрыта.");
            redirectToInvalidLink();
        },
        onFatalError: redirectToInvalidLink
    };
    initializeWebSocket(roomId, wsHandlers, logToScreen);

    updateRoomLifetime();
    lifetimeTimerInterval = setInterval(updateRoomLifetime, 60000);
}

function handleUserList(users) {
    const otherUsers = users.filter(u => u.id !== currentUser.id);

    if (otherUsers.length === 0) {
        targetUser = {};
        uiManager.showPopup('waiting');
    } else {
        targetUser = otherUsers[0];
        if (targetUser.status === 'busy') {
            uiManager.showPopup('initiating');
        } else {
            uiManager.showPopup('actions');
        }
    }
}

async function initiateCall(userToCall, callType) {
    logToScreen(`[CALL] Initiating call to user ${userToCall.id}, type: ${callType}`);
    isCallInitiator = true;
    currentCallType = callType;
    
    if (currentCallType === 'video') {
        ui.remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType);
    if (!hasMedia) logToScreen("[CALL] Proceeding with call without local media.");

    targetUser = userToCall;

    monitor.connectionLogger.reset(roomId, currentUser.id, isCallInitiator);
    const probeResults = await monitor.probeIceServers();
    monitor.connectionLogger.setProbeResults(probeResults);

    sendMessage({ type: 'call_user', data: { target_id: targetUser.id, call_type: currentCallType } });

    uiManager.showScreen('call');
    uiManager.updateCallUI(currentCallType, targetUser, media.getMediaAccessStatus(), isMobileDevice());
    ui.callTimer.textContent = "Вызов...";
    ui.ringOutAudio.play();
}

function handleIncomingCall(data) {
    logToScreen(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    isCallInitiator = false;
    targetUser = data.from_user;
    currentCallType = data.call_type;

    ui.callerName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    ui.incomingCallType.textContent = currentCallType === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок';
    uiManager.showModal('incoming-call', true);
    ui.ringInAudio.play();
}

async function acceptCall() {
    logToScreen("[CALL] 'Accept' button pressed.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);

    if (currentCallType === 'video') {
        ui.remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType);
    if (!hasMedia) logToScreen("[CALL] No local media available, accepting as receive-only.");

    logToScreen("[CALL] Starting WebRTC connection.");
    
    monitor.connectionLogger.reset(roomId, currentUser.id, isCallInitiator);
    
    const localStream = media.getLocalStream();
    await webrtc.startPeerConnection(targetUser.id, false, currentCallType, localStream, rtcConfig, monitor.connectionLogger);
    sendMessage({ type: 'call_accepted', data: { target_id: targetUser.id } });
}

function declineCall() {
    logToScreen("[CALL] Declining call.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    sendMessage({ type: 'call_declined', data: { target_id: targetUser.id } });
    targetUser = {};
}

async function endCall(isInitiator, reason) {
    if (isEndingCall) return;
    isEndingCall = true;

    logToScreen(`[CALL] Ending call. Initiator: ${isInitiator}, Reason: ${reason}`);
    setGracefulDisconnect(true);

    if (isInitiator && targetUser.id) {
        sendMessage({ type: 'hangup', data: { target_id: targetUser.id } });
    }

    if (isInitiator && !monitor.connectionLogger.isDataSent) {
        monitor.connectionLogger.sendProbeLog();
    }

    ui.connectionQuality.classList.remove('active');
    monitor.stopConnectionMonitoring();

    webrtc.endPeerConnection();
    media.stopAllStreams();
    if (ui.remoteAudioLevel) ui.remoteAudioLevel.style.display = 'none';

    ui.ringOutAudio.pause(); ui.ringOutAudio.currentTime = 0;
    uiManager.stopIncomingRing();

    ui.localAudio.srcObject = null;
    ui.localVideo.srcObject = null;
    ui.localVideoContainer.style.display = 'none';
    ui.remoteVideo.style.display = 'none';
    
    uiManager.stopTimer();
    uiManager.showModal('incoming-call', false);
    uiManager.showScreen('pre-call');

    targetUser = {};
    uiManager.resetCallControls();
    isEndingCall = false;
}

function setupEventListeners() {
    ui.continueToCallBtn.addEventListener('click', () => proceedToCall(false));
    ui.continueSpectatorBtn.addEventListener('click', () => proceedToCall(true));
    ui.cameraSelect.addEventListener('change', updatePreviewStream);
    ui.micSelect.addEventListener('change', updatePreviewStream);
    ui.speakerSelect.addEventListener('change', updatePreviewStream);

    ui.speakerBtn.addEventListener('click', toggleSpeaker);
    ui.muteBtn.addEventListener('click', toggleMute);
    ui.videoBtn.addEventListener('click', toggleVideo);
    ui.screenShareBtn.addEventListener('click', () => webrtc.toggleScreenShare(media.getLocalStream(), (isSharing) => uiManager.updateScreenShareUI(isSharing, isVideoEnabled, currentCallType)));
    ui.acceptBtn.addEventListener('click', acceptCall);
    ui.declineBtn.addEventListener('click', declineCall);
    
    ui.hangupBtn.addEventListener('click', () => endCall(true, 'cancelled_by_user'));
    
    ui.closeSessionBtn.addEventListener('click', closeSession);

    ui.instructionsBtn.addEventListener('click', () => ui.instructionsModal.classList.add('active'));
    ui.closeInstructionsBtns.forEach(btn => btn.addEventListener('click', () => ui.instructionsModal.classList.remove('active')));

    ui.deviceSettingsBtn.addEventListener('click', openDeviceSettings);
    ui.closeSettingsBtns.forEach(btn => btn.addEventListener('click', () => ui.deviceSettingsModal.classList.remove('active')));
    ui.cameraSelectCall.addEventListener('change', (e) => switchInputDevice('video', e.target.value));
    ui.micSelectCall.addEventListener('change', (e) => switchInputDevice('audio', e.target.value));
    ui.speakerSelectCall.addEventListener('change', (e) => switchAudioOutput(e.target.value));

    ui.popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        if (button && targetUser.id) {
            initiateCall(targetUser, button.dataset.callType);
        }
    });

    ui.toggleLocalViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.localVideo.classList.toggle('force-cover');
        const iconSpan = ui.toggleLocalViewBtn.querySelector('.icon');
        iconSpan.innerHTML = ui.localVideo.classList.contains('force-cover') ? ICONS.localViewCover : ICONS.localViewContain;
    });

    ui.toggleRemoteViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.remoteVideo.classList.toggle('force-cover');
        const iconSpan = ui.toggleRemoteViewBtn.querySelector('.icon');
        iconSpan.innerHTML = ui.remoteVideo.classList.contains('force-cover') ? ICONS.remoteViewContain : ICONS.remoteViewCover;
    });

    ui.connectionStatus.addEventListener('click', uiManager.showConnectionInfo);

    setupLocalVideoInteraction();
}

function setupLocalVideoInteraction() {
    let isDragging = false, hasMoved = false, dragStartX, offsetX, longPressTimer;

    const onDragStart = (e) => {
        if (e.type === 'touchstart' && e.touches.length > 1) return;
        hasMoved = false;
        const rect = ui.localVideoContainer.getBoundingClientRect();
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        dragStartX = clientX;
        offsetX = clientX - rect.left;
        longPressTimer = setTimeout(() => {
            isDragging = true;
            ui.localVideoContainer.classList.add('dragging');
        }, 200);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchend', onDragEnd);
    };

    const onDragMove = (e) => {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        if (!hasMoved && Math.abs(clientX - dragStartX) > 5) {
            hasMoved = true;
            clearTimeout(longPressTimer);
            if (!isDragging) {
                isDragging = true;
                ui.localVideoContainer.classList.add('dragging');
            }
        }
        if (isDragging) {
            if (e.type === 'touchmove') e.preventDefault();
            let newLeft = clientX - offsetX;
            const parentWidth = ui.localVideoContainer.parentElement.clientWidth;
            const videoWidth = ui.localVideoContainer.getBoundingClientRect().width;
            newLeft = Math.max(0, Math.min(newLeft, parentWidth - videoWidth));
            ui.localVideoContainer.style.left = `${newLeft}px`;
        }
    };

    const onDragEnd = (e) => {
        clearTimeout(longPressTimer);
        if (!hasMoved && !e.target.closest('button')) {
            ui.localVideoContainer.classList.toggle('small');
        }
        isDragging = false;
        ui.localVideoContainer.classList.remove('dragging');
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);
    };

    ui.localVideoContainer.addEventListener('mousedown', onDragStart);
    ui.localVideoContainer.addEventListener('touchstart', onDragStart, { passive: true });
}

async function initializeLocalMedia(callType) {
    if (isSpectator) {
        logToScreen("[MEDIA] Spectator mode, skipping media initialization.");
        return false;
    }
    logToScreen(`[MEDIA] Requesting media for call type: ${callType}`);
    
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    let isVideoCall = callType === 'video';
    
    const isIOSAudioCall = isIOS() && callType === 'audio';
    if (isIOSAudioCall) {
        logToScreen("[MEDIA_IOS] Audio call on iOS detected. Requesting video to force speakerphone.");
        isVideoCall = true; 
    }

    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
        video: isVideoCall && hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
    };

    const result = await media.getStreamForCall(constraints, ui.localVideo, ui.localAudio);
    
    if (result.stream) {
        if (isIOSAudioCall && result.stream.getVideoTracks().length > 0) {
            logToScreen("[MEDIA_IOS] Video track obtained for audio call. Disabling it now.");
            result.stream.getVideoTracks()[0].enabled = false;
            ui.localVideoContainer.style.display = 'none';
            isVideoEnabled = false;
        } else if (result.isVideo) {
            ui.localVideoContainer.style.display = 'flex';
            isVideoEnabled = true;
        } else {
            ui.localVideoContainer.style.display = 'none';
            isVideoEnabled = false;
        }
        return true;
    }
    return false;
}

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function toggleMute() {
    if (!media.getMediaAccessStatus().hasMicrophoneAccess) return;
    isMuted = !isMuted;
    webrtc.toggleMute(isMuted, media.getLocalStream());
    ui.muteBtn.classList.toggle('active', isMuted);
    logToScreen(`[CONTROLS] Mic ${isMuted ? 'muted' : 'unmuted'}.`);
}

function toggleSpeaker() {
    isSpeakerMuted = media.toggleRemoteSpeakerMute();
    ui.speakerBtn.classList.toggle('active', isSpeakerMuted);
    logToScreen(`[CONTROLS] Remote audio (speaker) ${isSpeakerMuted ? 'muted' : 'unmuted'}.`);
}

function toggleVideo() {
    if (!media.getMediaAccessStatus().hasCameraAccess) return;
    isVideoEnabled = !isVideoEnabled;
    webrtc.toggleVideo(isVideoEnabled, media.getLocalStream());
    ui.videoBtn.classList.toggle('active', !isVideoEnabled);
    ui.localVideoContainer.style.display = isVideoEnabled ? 'flex' : 'none';
    logToScreen(`[CONTROLS] Video ${isVideoEnabled ? 'enabled' : 'disabled'}.`);
}

async function openDeviceSettings() {
    await populateDeviceSelectorsInCall();
    ui.deviceSettingsModal.classList.add('active');
}

async function populateDeviceSelectorsInCall() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(d => d.kind === 'videoinput');
    audioInDevices = devices.filter(d => d.kind === 'audioinput');
    audioOutDevices = devices.filter(d => d.kind === 'audiooutput');

    const populate = (select, devicesList, container, currentId) => {
        container.style.display = devicesList.length > 0 ? 'flex' : 'none';
        if (devicesList.length === 0) return;
        
        select.innerHTML = '';
        devicesList.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `${select.id} ${select.options.length + 1}`;
            if (device.deviceId === currentId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    };

    const localStream = media.getLocalStream();
    const currentAudioTrack = localStream?.getAudioTracks()[0];
    const currentVideoTrack = localStream?.getVideoTracks()[0];
    
    populate(ui.micSelectCall, audioInDevices, ui.micSelectContainerCall, currentAudioTrack?.getSettings().deviceId);
    populate(ui.cameraSelectCall, videoDevices, ui.cameraSelectContainerCall, currentVideoTrack?.getSettings().deviceId);
    populate(ui.speakerSelectCall, audioOutDevices, ui.speakerSelectContainerCall, selectedAudioOutId);
}

async function switchInputDevice(kind, deviceId) {
    const localStream = media.getLocalStream();
    const newTrack = await webrtc.switchInputDevice(kind, deviceId, localStream);
    if (newTrack) {
        if (kind === 'video') {
            selectedVideoId = deviceId;
        } else {
            media.visualizeLocalMicForCall(localStream);
            selectedAudioInId = deviceId;
        }
    }
}

async function switchAudioOutput(deviceId) {
    if (typeof ui.remoteVideo.setSinkId !== 'function') {
        logToScreen('[SINK] setSinkId() is not supported by this browser.');
        alert('Ваш браузер не поддерживает переключение динамиков.');
        return;
    }
    try {
        await ui.remoteVideo.setSinkId(deviceId);
        await ui.remoteAudio.setSinkId(deviceId);
        selectedAudioOutId = deviceId;
        logToScreen(`[SINK] Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        logToScreen(`[SINK] Error switching audio output: ${error}`);
        alert(`Не удалось переключить динамик: ${error.message}`);
    }
}

async function updateRoomLifetime() {
    try {
        const response = await fetch(`/room/lifetime/${roomId}`);
        if (!response.ok) throw new Error('Room not found or expired on server.');
        const data = await response.json();
        const remainingSeconds = data.remaining_seconds;
        if (remainingSeconds <= 0) {
            ui.lifetimeTimer.textContent = "00:00";
            clearInterval(lifetimeTimerInterval);
            alert("Время жизни ссылки истекло.");
            redirectToInvalidLink();
        } else {
            const hours = Math.floor(remainingSeconds / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            ui.lifetimeTimer.textContent = `${String(hours).padStart(2, '0')} ч. ${String(minutes).padStart(2, '0')} м.`;
        }
    } catch (error) {
        logToScreen(`[LIFETIME] Error fetching lifetime: ${error.message}`);
        ui.lifetimeTimer.textContent = "Ошибка";
        clearInterval(lifetimeTimerInterval);
    }
}

async function closeSession() {
    logToScreen("[SESSION] User clicked close session button.");
    setGracefulDisconnect(true);
    try {
        await fetch(`/room/close/${roomId}`, { method: 'POST' });
    } catch (error) {
        logToScreen(`[SESSION] Error sending close request: ${error}`);
        alert("Не удалось закрыть сессию. Попробуйте обновить страницу.");
    }
}

function redirectToInvalidLink() {
    setGracefulDisconnect(true);
    window.location.reload();
}