// static/js/main.js
import {
    previewVideo, micLevelBars, continueToCallBtn, cameraSelect,
    micSelect, speakerSelect, cameraSelectContainer, micSelectContainer, speakerSelectContainer,
    popupActions, lifetimeTimer, closeSessionBtn, instructionsBtn, instructionsModal,
    closeInstructionsBtns, callerName, incomingCallType, acceptBtn, declineBtn, hangupBtn,
    speakerBtn, muteBtn, videoBtn, screenShareBtn, localAudio, remoteAudio, localVideo,
    remoteVideo, localVideoContainer, toggleLocalViewBtn, toggleRemoteViewBtn, ringOutAudio,
    connectAudio, ringInAudio, connectionStatus, connectionQuality, remoteAudioLevel,
    deviceSettingsBtn, deviceSettingsModal, closeSettingsBtns, cameraSelectCall, micSelectCall,
    speakerSelectCall, cameraSelectContainerCall, micSelectContainerCall, speakerSelectContainerCall
} from './call_ui_elements.js';

import { initializeWebSocket, sendMessage, setGracefulDisconnect } from './call_websocket.js';
import * as webrtc from './call_webrtc.js';
import * as media from './call_media.js';
import * as monitor from './call_connection_monitor.js';
import * as uiManager from './call_ui_manager.js';

const tg = window.Telegram.WebApp;

let currentUser = {};
let targetUser = {};
let currentCallType = 'audio';
let callTimerInterval;
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
    
    // Всегда выводим в консоль браузера
    console.log(logMessage);

    // Список префиксов, которые не нужно отправлять на сервер
    const prefixesToIgnore = [
        '[STATS]', 
        '[DC]', 
        '[WEBRTC] ICE State:', 
        '[PROBE]', 
        '[SINK]',
        '[WEBRTC] Signaling State:'
    ];

    // Проверяем, нужно ли отправлять лог на сервер
    const shouldSendToServer = !prefixesToIgnore.some(prefix => message.startsWith(prefix));

    if (shouldSendToServer) {
        sendLogToServer(logMessage);
    }
}

function loadIcons() {
    const iconPlaceholders = document.querySelectorAll('[data-icon-name]');
    if (typeof ICONS === 'undefined') {
        console.error('icons.js is not loaded or ICONS object is not defined.');
        return;
    }
    iconPlaceholders.forEach(placeholder => {
        const iconName = placeholder.dataset.iconName;
        if (ICONS[iconName]) {
            placeholder.innerHTML = ICONS[iconName];
        } else {
            console.warn(`Icon with name "${iconName}" not found.`);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    loadIcons();
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
        getRtcConfig: () => rtcConfig,
        onConnectionEstablished: (type) => {
            sendMessage({ type: 'connection_established', data: { type: type } });
        }
    });

    const webrtcCallbacks = {
        log: logToScreen,
        onCallConnected: () => {
            uiManager.showCallingOverlay(false); // Скрываем оверлей вызова
            uiManager.showScreen('call');
            const mediaStatus = media.getMediaAccessStatus();
            uiManager.updateCallUI(currentCallType, targetUser, mediaStatus, isMobileDevice());
            callTimerInterval = uiManager.startCallTimer(currentCallType);
            connectAudio.play();
            
            connectionQuality.classList.add('active');
            monitor.startConnectionMonitoring();
        },
        onCallEndedByPeer: (reason) => endCall(false, reason),
        onRemoteTrack: (stream) => media.visualizeRemoteMic(stream),
        onRemoteMuteStatus: uiManager.handleRemoteMuteStatus,
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
    
    const { hasCameraAccess, hasMicrophoneAccess } = await media.initializePreview(previewVideo, micLevelBars);

    if (!hasCameraAccess || !hasMicrophoneAccess) {
        uiManager.displayMediaErrors({ name: 'NotFoundError' });
    }

    uiManager.updateStatusIndicators(hasCameraAccess, hasMicrophoneAccess);

    if (hasCameraAccess || hasMicrophoneAccess) {
        const selectedIds = await media.populateDeviceSelectors(
            cameraSelect, micSelect, speakerSelect,
            cameraSelectContainer, micSelectContainer, speakerSelectContainer
        );
        selectedVideoId = selectedIds.videoId;
        selectedAudioInId = selectedIds.audioInId;
        selectedAudioOutId = selectedIds.audioOutId;
        continueToCallBtn.disabled = false;
    } else {
        logToScreen('[MEDIA_CHECK] No media devices available or access denied to all.');
    }
}

async function updatePreviewStream() {
    selectedVideoId = cameraSelect.value;
    selectedAudioInId = micSelect.value;
    selectedAudioOutId = speakerSelect.value;
    
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();

    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
        video: hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
    };

    await media.updatePreviewStream(constraints, previewVideo, micLevelBars);
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
            ringOutAudio.pause(); 
            ringOutAudio.currentTime = 0;
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
        remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType);
    if (!hasMedia) logToScreen("[CALL] Proceeding with call without local media.");

    targetUser = userToCall;

    monitor.connectionLogger.reset(roomId, currentUser.id, isCallInitiator);
    const probeResults = await monitor.probeIceServers();
    monitor.connectionLogger.setProbeResults(probeResults);

    sendMessage({ type: 'call_user', data: { target_id: targetUser.id, call_type: currentCallType } });

    uiManager.showScreen('call');
    const mediaStatus = media.getMediaAccessStatus();
    uiManager.updateCallUI(currentCallType, targetUser, mediaStatus, isMobileDevice());
    uiManager.showCallingOverlay(true, currentCallType); // Показываем оверлей вызова
    ringOutAudio.play();
}

function handleIncomingCall(data) {
    logToScreen(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    isCallInitiator = false;
    targetUser = data.from_user;
    currentCallType = data.call_type;

    callerName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    incomingCallType.textContent = currentCallType === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок';
    uiManager.showModal('incoming-call', true);
    ringInAudio.play();
}

async function acceptCall() {
    logToScreen("[CALL] 'Accept' button pressed.");
    stopIncomingRing();
    uiManager.showModal('incoming-call', false);

    if (currentCallType === 'video') {
        remoteVideo.play().catch(() => {});
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
    stopIncomingRing();
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

    connectionQuality.classList.remove('active');
    monitor.stopConnectionMonitoring();

    webrtc.endPeerConnection();
    media.stopAllStreams();
    if (remoteAudioLevel) remoteAudioLevel.style.display = 'none';

    ringOutAudio.pause(); ringOutAudio.currentTime = 0;
    stopIncomingRing();

    localAudio.srcObject = null;
    localVideo.srcObject = null;
    localVideoContainer.style.display = 'none';
    remoteVideo.style.display = 'none';
    
    uiManager.stopCallTimer(callTimerInterval);
    callTimerInterval = null;
    uiManager.showModal('incoming-call', false);
    uiManager.showCallingOverlay(false); // Скрываем оверлей вызова при завершении
    uiManager.showScreen('pre-call');

    targetUser = {};
    resetCallState();
    uiManager.resetCallControls();
}

function setupEventListeners() {
    continueToCallBtn.addEventListener('click', () => proceedToCall(false));
    document.getElementById('continue-spectator-btn').addEventListener('click', () => proceedToCall(true));
    cameraSelect.addEventListener('change', updatePreviewStream);
    micSelect.addEventListener('change', updatePreviewStream);
    speakerSelect.addEventListener('change', updatePreviewStream);

    speakerBtn.addEventListener('click', toggleSpeaker);
    muteBtn.addEventListener('click', toggleMute);
    videoBtn.addEventListener('click', toggleVideo);
    screenShareBtn.addEventListener('click', () => webrtc.toggleScreenShare(media.getLocalStream(), (isSharing) => uiManager.updateScreenShareUI(isSharing, isVideoEnabled, currentCallType)));
    acceptBtn.addEventListener('click', acceptCall);
    declineBtn.addEventListener('click', declineCall);
    
    hangupBtn.addEventListener('click', () => endCall(true, 'cancelled_by_user'));
    
    closeSessionBtn.addEventListener('click', closeSession);

    instructionsBtn.addEventListener('click', () => instructionsModal.classList.add('active'));
    closeInstructionsBtns.forEach(btn => btn.addEventListener('click', () => instructionsModal.classList.remove('active')));

    deviceSettingsBtn.addEventListener('click', openDeviceSettings);
    closeSettingsBtns.forEach(btn => btn.addEventListener('click', () => deviceSettingsModal.classList.remove('active')));
    cameraSelectCall.addEventListener('change', (e) => switchInputDevice('video', e.target.value));
    micSelectCall.addEventListener('change', (e) => switchInputDevice('audio', e.target.value));
    speakerSelectCall.addEventListener('change', (e) => switchAudioOutput(e.target.value));

    popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        if (button && targetUser.id) {
            initiateCall(targetUser, button.dataset.callType);
        }
    });

    toggleLocalViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        localVideo.classList.toggle('force-cover');
        const iconSpan = toggleLocalViewBtn.querySelector('.icon');
        iconSpan.innerHTML = localVideo.classList.contains('force-cover') ? ICONS.localViewCover : ICONS.localViewContain;
    });

    toggleRemoteViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        remoteVideo.classList.toggle('force-cover');
        const iconSpan = toggleRemoteViewBtn.querySelector('.icon');
        iconSpan.innerHTML = remoteVideo.classList.contains('force-cover') ? ICONS.remoteViewContain : ICONS.remoteViewCover;
    });

    connectionStatus.addEventListener('click', () => {
        const details = monitor.getCurrentConnectionDetails();
        uiManager.showConnectionInfo(details);
    });

    setupLocalVideoInteraction();
}

function setupLocalVideoInteraction() {
    let isDragging = false, hasMoved = false, dragStartX, offsetX, longPressTimer;

    const onDragStart = (e) => {
        if (e.type === 'touchstart' && e.touches.length > 1) return;
        hasMoved = false;
        const rect = localVideoContainer.getBoundingClientRect();
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        dragStartX = clientX;
        offsetX = clientX - rect.left;
        longPressTimer = setTimeout(() => {
            isDragging = true;
            localVideoContainer.classList.add('dragging');
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
                localVideoContainer.classList.add('dragging');
            }
        }
        if (isDragging) {
            if (e.type === 'touchmove') e.preventDefault();
            let newLeft = clientX - offsetX;
            const parentWidth = localVideoContainer.parentElement.clientWidth;
            const videoWidth = localVideoContainer.getBoundingClientRect().width;
            newLeft = Math.max(0, Math.min(newLeft, parentWidth - videoWidth));
            localVideoContainer.style.left = `${newLeft}px`;
        }
    };

    const onDragEnd = (e) => {
        clearTimeout(longPressTimer);
        if (!hasMoved && !e.target.closest('button')) {
            localVideoContainer.classList.toggle('small');
        }
        isDragging = false;
        localVideoContainer.classList.remove('dragging');
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);
    };

    localVideoContainer.addEventListener('mousedown', onDragStart);
    localVideoContainer.addEventListener('touchstart', onDragStart, { passive: true });
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

    const result = await media.getStreamForCall(constraints, localVideo, localAudio);
    
    if (result.stream) {
        if (isIOSAudioCall && result.stream.getVideoTracks().length > 0) {
            logToScreen("[MEDIA_IOS] Video track obtained for audio call. Disabling it now.");
            result.stream.getVideoTracks()[0].enabled = false;
            localVideoContainer.style.display = 'none';
            isVideoEnabled = false;
        } else if (result.isVideo) {
            localVideoContainer.style.display = 'flex';
            isVideoEnabled = true;
        } else {
            localVideoContainer.style.display = 'none';
            isVideoEnabled = false;
        }
        return true;
    }
    return false;
}

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function stopIncomingRing() {
    ringInAudio.pause();
    ringInAudio.currentTime = 0;
}

function toggleMute() {
    if (!media.getMediaAccessStatus().hasMicrophoneAccess) return;
    isMuted = !isMuted;
    webrtc.toggleMute(isMuted, media.getLocalStream());
    muteBtn.classList.toggle('active', isMuted);
    logToScreen(`[CONTROLS] Mic ${isMuted ? 'muted' : 'unmuted'}.`);
}

function toggleSpeaker() {
    isSpeakerMuted = media.toggleRemoteSpeakerMute();
    speakerBtn.classList.toggle('active', isSpeakerMuted);
    logToScreen(`[CONTROLS] Remote audio (speaker) ${isSpeakerMuted ? 'muted' : 'unmuted'}.`);
}

function toggleVideo() {
    if (!media.getMediaAccessStatus().hasCameraAccess) return;
    isVideoEnabled = !isVideoEnabled;
    webrtc.toggleVideo(isVideoEnabled, media.getLocalStream());
    videoBtn.classList.toggle('active', !isVideoEnabled);
    localVideoContainer.style.display = isVideoEnabled ? 'flex' : 'none';
    logToScreen(`[CONTROLS] Video ${isVideoEnabled ? 'enabled' : 'disabled'}.`);
}

async function openDeviceSettings() {
    await populateDeviceSelectorsInCall();
    deviceSettingsModal.classList.add('active');
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
    
    populate(micSelectCall, audioInDevices, micSelectContainerCall, currentAudioTrack?.getSettings().deviceId);
    populate(cameraSelectCall, videoDevices, cameraSelectContainerCall, currentVideoTrack?.getSettings().deviceId);
    populate(speakerSelectCall, audioOutDevices, speakerSelectContainerCall, selectedAudioOutId);
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
    if (typeof remoteVideo.setSinkId !== 'function') {
        logToScreen('[SINK] setSinkId() is not supported by this browser.');
        alert('Ваш браузер не поддерживает переключение динамиков.');
        return;
    }
    try {
        await remoteVideo.setSinkId(deviceId);
        await remoteAudio.setSinkId(deviceId);
        selectedAudioOutId = deviceId;
        logToScreen(`[SINK] Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        logToScreen(`[SINK] Error switching audio output: ${error}`);
        alert(`Не удалось переключить динамик: ${error.message}`);
    }
}

function resetCallState() {
    isMuted = false; 
    isVideoEnabled = true; 
    isSpeakerMuted = false;
    isEndingCall = false;
}

async function updateRoomLifetime() {
    try {
        const response = await fetch(`/room/lifetime/${roomId}`);
        if (!response.ok) throw new Error('Room not found or expired on server.');
        const data = await response.json();
        const remainingSeconds = data.remaining_seconds;
        if (remainingSeconds <= 0) {
            lifetimeTimer.textContent = "00:00";
            clearInterval(lifetimeTimerInterval);
            alert("Время жизни ссылки истекло.");
            redirectToInvalidLink();
        } else {
            const hours = Math.floor(remainingSeconds / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            lifetimeTimer.textContent = `${String(hours).padStart(2, '0')} ч. ${String(minutes).padStart(2, '0')} м.`;
        }
    } catch (error) {
        logToScreen(`[LIFETIME] Error fetching lifetime: ${error.message}`);
        lifetimeTimer.textContent = "Ошибка";
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