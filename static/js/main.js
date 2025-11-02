### static/js/main.js
``````javascript
// static/js/main.js

import {
    preCallCheckScreen, previewVideo, micLevelBars, cameraStatus, cameraStatusText,
    micStatus, micStatusText, continueToCallBtn, continueSpectatorBtn, cameraSelect,
    micSelect, speakerSelect, cameraSelectContainer, micSelectContainer, speakerSelectContainer,
    preCallScreen, popupWaiting, popupActions, popupInitiating, lifetimeTimer,
    closeSessionBtn, instructionsBtn, instructionsModal, closeInstructionsBtns, callScreen,
    audioCallVisualizer, localGlow, remoteGlow, incomingCallModal, callerName,
    incomingCallType, acceptBtn, declineBtn, hangupBtn, remoteUserName, callTimer,
    speakerBtn, muteBtn, videoBtn, videoControlItem, switchCameraBtn, switchCameraControlItem,
    screenShareBtn, screenShareControlItem, localAudio, remoteAudio, localVideo, remoteVideo,
    localVideoContainer, toggleLocalViewBtn, toggleRemoteViewBtn, ringOutAudio, connectAudio,
    ringInAudio, connectionStatus, connectionQuality, qualityGoodSvg, qualityMediumSvg,
    qualityBadSvg, remoteAudioLevel, remoteAudioLevelBars, connectionInfoPopup,
    remoteMuteToast, connectionToast, deviceSettingsBtn, deviceSettingsModal,
    closeSettingsBtns, cameraSelectCall, micSelectCall, speakerSelectCall,
    cameraSelectContainerCall, micSelectContainerCall, speakerSelectContainerCall
} from './call_ui_elements.js';

import { initializeWebSocket, sendMessage, setGracefulDisconnect } from './call_websocket.js';
import * as webrtc from './call_webrtc.js';
import * as media from './call_media.js';
import * as monitor from './call_connection_monitor.js';

const tg = window.Telegram.WebApp;

let currentUser = {};
let targetUser = {};
let currentCallType = 'audio';
let callTimerInterval;
let lifetimeTimerInterval;
let uiFadeTimeout = null;
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
let infoPopupTimeout = null;
let isCallInitiator = false;
let isEndingCall = false;
let remoteMuteToastTimeout = null;

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
        updateConnectionIcon: updateConnectionIcon,
        updateConnectionQualityIcon: updateConnectionQualityIcon,
        showConnectionToast: showConnectionToast,
        getIceServerDetails: () => iceServerDetails,
        getRtcConfig: () => rtcConfig
    });

    const webrtcCallbacks = {
        log: logToScreen,
        onCallConnected: () => {
            if (!callScreen.classList.contains('active')) {
                showScreen('call');
                updateCallUI();
            }
            startTimer();
            connectAudio.play();
        },
        onCallEndedByPeer: (reason) => endCall(false, reason),
        onRemoteTrack: (stream) => media.visualizeRemoteMic(stream),
        onRemoteMuteStatus: handleRemoteMuteStatus,
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
    showScreen('pre-call-check');
    
    const { hasCameraAccess, hasMicrophoneAccess } = await media.initializePreview(previewVideo, micLevelBars);

    if (!hasCameraAccess || !hasMicrophoneAccess) {
        displayMediaErrors({ name: 'NotFoundError' }); // Simplified error display
        continueSpectatorBtn.style.display = 'block';
    }

    updateStatusIndicators(hasCameraAccess, hasMicrophoneAccess);

    if (hasCameraAccess || hasMicrophoneAccess) {
        // Важно: populateDeviceSelectors вызывается ПОСЛЕ initializePreview,
        // чтобы получить полный список устройств на мобильных.
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

function updateStatusIndicators(hasCamera, hasMic) {
    cameraStatus.classList.toggle('status-ok', hasCamera);
    cameraStatus.classList.toggle('status-error', !hasCamera);
    cameraStatusText.textContent = `Камера: ${hasCamera ? 'OK' : 'Нет доступа'}`;

    micStatus.classList.toggle('status-ok', hasMic);
    micStatus.classList.toggle('status-error', !hasMic);
    micStatusText.textContent = `Микрофон: ${hasMic ? 'OK' : 'Нет доступа'}`;
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
    // Placeholder for a more elegant error display
    console.error(message);
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

    showScreen('pre-call');
    showPopup('waiting');
    
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

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (screenName) document.getElementById(`${screenName}-screen`).classList.add('active');
}

function showModal(modalName, show) {
    const modal = document.getElementById(`${modalName}-modal`);
    if (modal) modal.classList.toggle('active', show);
}

function showPopup(popupName) {
    document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
    if (popupName) document.getElementById(`popup-${popupName}`).classList.add('active');
}

function resetUiFade() {
    callScreen.classList.add('ui-interactive');
    callScreen.classList.remove('ui-faded');
    clearTimeout(uiFadeTimeout);
    uiFadeTimeout = setTimeout(() => callScreen.classList.add('ui-faded'), 2000);
    setTimeout(() => callScreen.classList.remove('ui-interactive'), 150);
}

function setupVideoCallUiListeners() {
    callScreen.addEventListener('mousemove', resetUiFade);
    callScreen.addEventListener('click', resetUiFade);
    callScreen.addEventListener('touchstart', resetUiFade);
}

function removeVideoCallUiListeners() {
    callScreen.removeEventListener('mousemove', resetUiFade);
    callScreen.removeEventListener('click', resetUiFade);
    callScreen.removeEventListener('touchstart', resetUiFade);
}

function handleUserList(users) {
    const otherUsers = users.filter(u => u.id !== currentUser.id);

    if (otherUsers.length === 0) {
        targetUser = {};
        showPopup('waiting');
    } else {
        targetUser = otherUsers[0];
        if (targetUser.status === 'busy') {
            showPopup('initiating');
        } else {
            showPopup('actions');
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

    const hasMedia = await initializeLocalMedia(currentCallType === 'video');
    if (!hasMedia) logToScreen("[CALL] Proceeding with call without local media.");

    targetUser = userToCall;

    monitor.connectionLogger.reset(roomId, currentUser.id, isCallInitiator);
    const probeResults = await monitor.probeIceServers();
    monitor.connectionLogger.setProbeResults(probeResults);

    sendMessage({ type: 'call_user', data: { target_id: targetUser.id, call_type: currentCallType } });

    showScreen('call');
    updateCallUI();
    callTimer.textContent = "Вызов...";
    ringOutAudio.play();
}

function handleIncomingCall(data) {
    logToScreen(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    isCallInitiator = false;
    targetUser = data.from_user;
    currentCallType = data.call_type;

    callerName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    incomingCallType.textContent = currentCallType === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок';
    showModal('incoming-call', true);
    ringInAudio.play();
}

async function acceptCall() {
    logToScreen("[CALL] 'Accept' button pressed.");
    stopIncomingRing();
    showModal('incoming-call', false);

    if (currentCallType === 'video') {
        remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType === 'video');
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
    showModal('incoming-call', false);
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
    
    stopTimer();
    showModal('incoming-call', false);
    showScreen('pre-call');

    targetUser = {};
    resetCallControls();
}

function setupEventListeners() {
    continueToCallBtn.addEventListener('click', () => proceedToCall(false));
    continueSpectatorBtn.addEventListener('click', () => proceedToCall(true));
    cameraSelect.addEventListener('change', updatePreviewStream);
    micSelect.addEventListener('change', updatePreviewStream);
    speakerSelect.addEventListener('change', updatePreviewStream);

    speakerBtn.addEventListener('click', toggleSpeaker);
    muteBtn.addEventListener('click', toggleMute);
    videoBtn.addEventListener('click', toggleVideo);
    screenShareBtn.addEventListener('click', () => webrtc.toggleScreenShare(media.getLocalStream(), updateScreenShareUI));
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

    connectionStatus.addEventListener('click', showConnectionInfo);

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

async function initializeLocalMedia(isVideo) {
    if (isSpectator) {
        logToScreen("[MEDIA] Spectator mode, skipping media initialization.");
        return false;
    }
    logToScreen(`[MEDIA] Requesting media. Video requested: ${isVideo}`);
    
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
        video: isVideo && hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
    };

    const result = await media.getStreamForCall(constraints, localVideo, localAudio);
    
    if (result.stream) {
        if (result.isVideo) {
            localVideoContainer.style.display = 'flex';
            isVideoEnabled = true;
        } else {
            localVideoContainer.style.display = 'none';
            isVideoEnabled = false;
            if (constraints.video) {
                logToScreen("[MEDIA] WARNING: Video requested but no video track found.");
                currentCallType = 'audio';
            }
        }
        return true;
    }
    return false;
}

function handleRemoteMuteStatus(isMuted) {
    clearTimeout(remoteMuteToastTimeout);
    if (isMuted) {
        remoteMuteToast.textContent = "Собеседник выключил микрофон. 🔇";
        remoteMuteToast.classList.add('visible');
        remoteMuteToastTimeout = setTimeout(() => {
            remoteMuteToast.classList.remove('visible');
        }, 3000);
    } else {
        remoteMuteToast.classList.remove('visible');
    }
    logToScreen(`[REMOTE_STATUS] Peer is now ${isMuted ? 'muted' : 'unmuted'}.`);
}

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function stopIncomingRing() {
    ringInAudio.pause();
    ringInAudio.currentTime = 0;
}

function updateCallUI() {
    remoteUserName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    const isVideoCall = currentCallType === 'video';
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    
    videoControlItem.style.display = isVideoCall && hasCameraAccess ? 'flex' : 'none';
    muteBtn.parentElement.style.display = hasMicrophoneAccess ? 'flex' : 'none';
    screenShareControlItem.style.display = isVideoCall && !isMobileDevice() ? 'flex' : 'none';
    remoteVideo.style.display = isVideoCall ? 'block' : 'none';
    
    callScreen.classList.toggle('video-call-active', isVideoCall);
    callScreen.classList.toggle('audio-call-active', !isVideoCall);
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
        // Показываем контейнер, если есть хотя бы одно устройство для выбора
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
        // Применяем один и тот же ID к обоим элементам
        await remoteVideo.setSinkId(deviceId);
        await remoteAudio.setSinkId(deviceId);
        selectedAudioOutId = deviceId;
        logToScreen(`[SINK] Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        logToScreen(`[SINK] Error switching audio output: ${error}`);
        alert(`Не удалось переключить динамик: ${error.message}`);
    }
}

function updateScreenShareUI(isSharing) {
    screenShareBtn.classList.toggle('active', isSharing);
    localVideoContainer.style.display = isSharing ? 'none' : (isVideoEnabled && currentCallType === 'video' ? 'flex' : 'none');
}

function resetCallControls() {
    isMuted = false; isVideoEnabled = true; isSpeakerMuted = false;
    muteBtn.classList.remove('active');
    videoBtn.classList.remove('active');
    speakerBtn.classList.remove('active');
    screenShareBtn.classList.remove('active');
    localVideo.classList.remove('force-cover');
    remoteVideo.classList.remove('force-cover');
    toggleLocalViewBtn.querySelector('.icon').innerHTML = ICONS.localViewContain;
    toggleRemoteViewBtn.querySelector('.icon').innerHTML = ICONS.remoteViewCover;
    clearTimeout(uiFadeTimeout);
    removeVideoCallUiListeners();
    callScreen.classList.remove('ui-faded', 'ui-interactive', 'video-call-active', 'audio-call-active');
    audioCallVisualizer.style.display = 'none';
    remoteUserName.style.display = 'block';
    isEndingCall = false;
}

function startTimer() {
    callScreen.classList.add('call-connected');
    if (callTimerInterval) clearInterval(callTimerInterval);
    let seconds = 0;
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'none';
    callTimerInterval = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        callTimer.textContent = `${mins}:${secs}`;
    }, 1000);

    if (currentCallType === 'video') {
        setupVideoCallUiListeners();
        resetUiFade();
    } else {
        audioCallVisualizer.style.display = 'flex';
    }

    connectionQuality.classList.add('active');
    monitor.startConnectionMonitoring();
}

function stopTimer() {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'block';
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

function updateConnectionIcon(type) {
    connectionStatus.querySelectorAll('.icon:not(#connection-quality)').forEach(icon => icon.classList.remove('active'));
    const typeMap = {
        local: { id: 'conn-local', title: 'Прямое локальное соединение (LAN)' },
        p2p: { id: 'conn-p2p', title: 'Прямое P2P соединение (Direct)' },
        relay: { id: 'conn-relay', title: 'Соединение через сервер (Relay)' },
        unknown: { id: 'conn-unknown', title: 'Определение типа соединения...' }
    };
    const { id, title } = typeMap[type] || typeMap.unknown;
    document.getElementById(id)?.classList.add('active');
    connectionStatus.setAttribute('data-type-title', title);
    const qualityText = connectionStatus.title.split(' / ')[0] || 'Качество соединения';
    connectionStatus.title = `${qualityText} / ${title}`;
}

function updateConnectionQualityIcon(quality) {
    connectionQuality.classList.remove('quality-good', 'quality-medium', 'quality-bad');
    [qualityGoodSvg, qualityMediumSvg, qualityBadSvg].forEach(svg => {
        svg.classList.remove('active-quality-svg');
        svg.style.display = 'none';
    });
    const qualityMap = {
        good: { class: 'quality-good', text: 'Отличное соединение', svg: qualityGoodSvg },
        medium: { class: 'quality-medium', text: 'Среднее соединение', svg: qualityMediumSvg },
        bad: { class: 'quality-bad', text: 'Плохое соединение', svg: qualityBadSvg },
        unknown: { class: '', text: 'Оценка качества...', svg: null }
    };
    const { class: qualityClass, text: qualityText, svg: activeSvg } = qualityMap[quality] || qualityMap.unknown;
    if (qualityClass) connectionQuality.classList.add(qualityClass);
    if (activeSvg) {
        activeSvg.style.display = 'block';
        activeSvg.classList.add('active-quality-svg');
    }
    const typeTitle = connectionStatus.getAttribute('data-type-title') || 'Определение типа...';
    connectionStatus.title = `${qualityText} / ${typeTitle}`;
}

function showConnectionInfo() {
    const details = monitor.getCurrentConnectionDetails();
    if (!details) return;
    clearTimeout(infoPopupTimeout);
    connectionInfoPopup.textContent = `${details.region}, ${details.provider}`;
    connectionInfoPopup.classList.add('active');
    infoPopupTimeout = setTimeout(() => {
        connectionInfoPopup.classList.remove('active');
    }, 3000);
}

function showConnectionToast(type, message) {
    connectionToast.textContent = message;
    connectionToast.classList.remove('toast-good', 'toast-bad');
    connectionToast.classList.add(`toast-${type}`);
    connectionToast.classList.add('visible');
    setTimeout(() => {
        connectionToast.classList.remove('visible');
    }, 7000);
}