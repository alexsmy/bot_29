
// static/js/main.js 51_2

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
import * as state from './call_state.js'; // <-- НОВЫЙ ИМПОРТ

const tg = window.Telegram.WebApp;

// --- ВСЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ УДАЛЕНЫ ОТСЮДА ---

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function sendLogToServer(message) {
    const currentUser = state.getCurrentUser();
    const roomId = state.getRoomId();
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
        state.setRtcConfig({ iceServers: peerConnectionConfig, iceCandidatePoolSize: 10 });

        const details = {};
        servers.forEach(s => {
            let provider = 'Unknown';
            if (s.source) {
                try {
                    provider = new URL(s.source).hostname.replace(/^www\./, '');
                } catch (e) { provider = s.source; }
            } else if (s.provider) {
                provider = s.provider;
            }
            details[s.urls] = {
                region: s.region || 'global',
                provider: provider
            };
        });
        state.setIceServerDetails(details);

        logToScreen("ICE servers configuration and details loaded successfully.");
    } catch (error) {
        logToScreen(`[CRITICAL] Failed to fetch ICE servers: ${error.message}. Falling back to public STUN.`);
        alert("Не удалось загрузить конфигурацию сети. Качество звонка может быть низким.");
        state.setRtcConfig({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        });
    }

    if (path.startsWith('/call/')) {
        const parts = path.split('/');
        state.setRoomId(parts[2]);
        initializePrivateCallMode();
    } else {
        document.body.innerHTML = "<h1>Неверный URL</h1>";
    }
});

function initializePrivateCallMode() {
    logToScreen(`Initializing in Private Call mode for room: ${state.getRoomId()}`);
    
    media.init(logToScreen);

    monitor.init({
        log: logToScreen,
        getPeerConnection: webrtc.getPeerConnection,
        updateConnectionIcon: uiManager.updateConnectionIcon,
        updateConnectionQualityIcon: uiManager.updateConnectionQualityIcon,
        showConnectionToast: uiManager.showConnectionToast,
        getIceServerDetails: state.getIceServerDetails,
        getRtcConfig: state.getRtcConfig,
        onConnectionEstablished: (type) => {
            sendMessage({ type: 'connection_established', data: { type: type } });
        }
    });

    const webrtcCallbacks = {
        log: logToScreen,
        onCallConnected: () => {
            const { currentCallType, targetUser } = state.getState();
            uiManager.showScreen('call');
            const mediaStatus = media.getMediaAccessStatus();
            uiManager.updateCallUI(currentCallType, targetUser, mediaStatus, isMobileDevice());
            const timerId = uiManager.startCallTimer(currentCallType);
            state.setCallTimerInterval(timerId);
            connectAudio.play();
            
            connectionQuality.classList.add('active');
            monitor.startConnectionMonitoring();
        },
        onCallEndedByPeer: (reason) => endCall(false, reason),
        onRemoteTrack: (stream) => media.visualizeRemoteMic(stream),
        onRemoteMuteStatus: uiManager.handleRemoteMuteStatus,
        getTargetUser: state.getTargetUser,
        getSelectedAudioOutId: state.getSelectedAudioOutId,
        getCurrentConnectionType: monitor.getCurrentConnectionType,
        isVideoEnabled: state.isVideoOn,
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
        state.setSelectedVideoId(selectedIds.videoId);
        state.setSelectedAudioInId(selectedIds.audioInId);
        state.setSelectedAudioOutId(selectedIds.audioOutId);
        continueToCallBtn.disabled = false;
    } else {
        logToScreen('[MEDIA_CHECK] No media devices available or access denied to all.');
    }
}

async function updatePreviewStream() {
    state.setSelectedVideoId(cameraSelect.value);
    state.setSelectedAudioInId(micSelect.value);
    state.setSelectedAudioOutId(speakerSelect.value);
    
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    const { selectedAudioInId, selectedVideoId } = state.getState();

    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
        video: hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
    };

    await media.updatePreviewStream(constraints, previewVideo, micLevelBars);
}

function proceedToCall(asSpectator = false) {
    state.setIsSpectator(asSpectator);
    logToScreen(`Proceeding to call screen. Spectator mode: ${asSpectator}`);
    media.stopPreviewStream();

    uiManager.showScreen('pre-call');
    uiManager.showPopup('waiting');
    
    const wsHandlers = {
        onIdentity: (data) => {
            const user = { id: data.id };
            state.setCurrentUser(user);
            logToScreen(`[WS] Identity assigned by server: ${user.id}`);
        },
        onUserList: handleUserList,
        onIncomingCall: handleIncomingCall,
        onCallAccepted: () => {
            ringOutAudio.pause(); 
            ringOutAudio.currentTime = 0;
            const localStream = media.getLocalStream();
            webrtc.startPeerConnection(state.getTargetUser().id, true, state.getState().currentCallType, localStream, state.getRtcConfig(), monitor.connectionLogger);
        },
        onOffer: (data) => {
            const localStream = media.getLocalStream();
            webrtc.handleOffer(data, localStream, state.getRtcConfig(), monitor.connectionLogger);
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
    initializeWebSocket(state.getRoomId(), wsHandlers, logToScreen);

    updateRoomLifetime();
    const timerId = setInterval(updateRoomLifetime, 60000);
    state.setLifetimeTimerInterval(timerId);
}

function handleUserList(users) {
    const otherUsers = users.filter(u => u.id !== state.getCurrentUser().id);

    if (otherUsers.length === 0) {
        state.setTargetUser({});
        uiManager.showPopup('waiting');
    } else {
        const target = otherUsers[0];
        state.setTargetUser(target);
        if (target.status === 'busy') {
            uiManager.showPopup('initiating');
        } else {
            uiManager.showPopup('actions');
        }
    }
}

async function initiateCall(userToCall, callType) {
    logToScreen(`[CALL] Initiating call to user ${userToCall.id}, type: ${callType}`);
    state.setIsCallInitiator(true);
    state.setCurrentCallType(callType);
    
    if (callType === 'video') {
        remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(callType);
    if (!hasMedia) logToScreen("[CALL] Proceeding with call without local media.");

    state.setTargetUser(userToCall);

    monitor.connectionLogger.reset(state.getRoomId(), state.getCurrentUser().id, true);
    const probeResults = await monitor.probeIceServers();
    monitor.connectionLogger.setProbeResults(probeResults);

    sendMessage({ type: 'call_user', data: { target_id: userToCall.id, call_type: callType } });

    uiManager.showScreen('call');
    const mediaStatus = media.getMediaAccessStatus();
    uiManager.updateCallUI(callType, userToCall, mediaStatus, isMobileDevice());
    callTimer.textContent = "Вызов...";
    ringOutAudio.play();
}

function handleIncomingCall(data) {
    logToScreen(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    state.setIsCallInitiator(false);
    state.setTargetUser(data.from_user);
    state.setCurrentCallType(data.call_type);

    callerName.textContent = `${data.from_user?.first_name || 'Собеседник'}`;
    incomingCallType.textContent = data.call_type === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок';
    uiManager.showModal('incoming-call', true);
    ringInAudio.play();
}

async function acceptCall() {
    logToScreen("[CALL] 'Accept' button pressed.");
    stopIncomingRing();
    uiManager.showModal('incoming-call', false);

    const { currentCallType, targetUser } = state.getState();

    if (currentCallType === 'video') {
        remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType);
    if (!hasMedia) logToScreen("[CALL] No local media available, accepting as receive-only.");

    logToScreen("[CALL] Starting WebRTC connection.");
    
    monitor.connectionLogger.reset(state.getRoomId(), state.getCurrentUser().id, false);
    
    const localStream = media.getLocalStream();
    await webrtc.startPeerConnection(targetUser.id, false, currentCallType, localStream, state.getRtcConfig(), monitor.connectionLogger);
    sendMessage({ type: 'call_accepted', data: { target_id: targetUser.id } });
}

function declineCall() {
    logToScreen("[CALL] Declining call.");
    stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    sendMessage({ type: 'call_declined', data: { target_id: state.getTargetUser().id } });
    state.setTargetUser({});
}

async function endCall(isInitiator, reason) {
    const { isEndingCall, targetUser, callTimerInterval } = state.getState();
    if (isEndingCall) return;
    state.setIsEndingCall(true);

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
    uiManager.showModal('incoming-call', false);
    uiManager.showScreen('pre-call');

    state.resetCallState();
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
    screenShareBtn.addEventListener('click', () => {
        const { isVideoEnabled, currentCallType } = state.getState();
        webrtc.toggleScreenShare(media.getLocalStream(), (isSharing) => uiManager.updateScreenShareUI(isSharing, isVideoEnabled, currentCallType));
    });
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
        const targetUser = state.getTargetUser();
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
    const { isSpectator, selectedAudioInId, selectedVideoId } = state.getState();
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
            state.setIsVideoEnabled(false);
        } else if (result.isVideo) {
            localVideoContainer.style.display = 'flex';
            state.setIsVideoEnabled(true);
        } else {
            localVideoContainer.style.display = 'none';
            state.setIsVideoEnabled(false);
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
    const currentState = state.getState();
    const newMutedState = !currentState.isMuted;
    state.setIsMuted(newMutedState);
    webrtc.toggleMute(newMutedState, media.getLocalStream());
    muteBtn.classList.toggle('active', newMutedState);
    logToScreen(`[CONTROLS] Mic ${newMutedState ? 'muted' : 'unmuted'}.`);
}

function toggleSpeaker() {
    const newSpeakerMutedState = media.toggleRemoteSpeakerMute();
    state.setIsSpeakerMuted(newSpeakerMutedState);
    speakerBtn.classList.toggle('active', newSpeakerMutedState);
    logToScreen(`[CONTROLS] Remote audio (speaker) ${newSpeakerMutedState ? 'muted' : 'unmuted'}.`);
}

function toggleVideo() {
    if (!media.getMediaAccessStatus().hasCameraAccess) return;
    const newVideoState = !state.getState().isVideoEnabled;
    state.setIsVideoEnabled(newVideoState);
    webrtc.toggleVideo(newVideoState, media.getLocalStream());
    videoBtn.classList.toggle('active', !newVideoState);
    localVideoContainer.style.display = newVideoState ? 'flex' : 'none';
    logToScreen(`[CONTROLS] Video ${newVideoState ? 'enabled' : 'disabled'}.`);
}

async function openDeviceSettings() {
    await populateDeviceSelectorsInCall();
    deviceSettingsModal.classList.add('active');
}

async function populateDeviceSelectorsInCall() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const audioInDevices = devices.filter(d => d.kind === 'audioinput');
    const audioOutDevices = devices.filter(d => d.kind === 'audiooutput');

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
    populate(speakerSelectCall, audioOutDevices, speakerSelectContainerCall, state.getSelectedAudioOutId());
}

async function switchInputDevice(kind, deviceId) {
    const localStream = media.getLocalStream();
    const newTrack = await webrtc.switchInputDevice(kind, deviceId, localStream);
    if (newTrack) {
        if (kind === 'video') {
            state.setSelectedVideoId(deviceId);
        } else {
            media.visualizeLocalMicForCall(localStream);
            state.setSelectedAudioInId(deviceId);
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
        state.setSelectedAudioOutId(deviceId);
        logToScreen(`[SINK] Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        logToScreen(`[SINK] Error switching audio output: ${error}`);
        alert(`Не удалось переключить динамик: ${error.message}`);
    }
}

async function updateRoomLifetime() {
    const roomId = state.getRoomId();
    const lifetimeTimerInterval = state.getState().lifetimeTimerInterval;
    try {
        const response = await fetch(`/room/lifetime/${roomId}`);
        if (!response.ok) throw new Error('Room not found or expired on server.');
        const data = await response.json();
        const remainingSeconds = data.remaining_seconds;
        if (remainingSeconds <= 0) {
            lifetimeTimer.textContent = "00:00";
            if (lifetimeTimerInterval) clearInterval(lifetimeTimerInterval);
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
        if (lifetimeTimerInterval) clearInterval(lifetimeTimerInterval);
    }
}

async function closeSession() {
    logToScreen("[SESSION] User clicked close session button.");
    setGracefulDisconnect(true);
    try {
        await fetch(`/room/close/${state.getRoomId()}`, { method: 'POST' });
    } catch (error) {
        logToScreen(`[SESSION] Error sending close request: ${error}`);
        alert("Не удалось закрыть сессию. Попробуйте обновить страницу.");
    }
}

function redirectToInvalidLink() {
    setGracefulDisconnect(true);
    window.location.reload();
}