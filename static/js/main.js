
// static/js/main.js 51_3

import {
    previewVideo, micLevelBars, continueToCallBtn, cameraSelect,
    micSelect, speakerSelect, cameraSelectContainer, micSelectContainer, speakerSelectContainer,
    popupActions, closeSessionBtn, instructionsBtn, instructionsModal,
    closeInstructionsBtns, acceptBtn, declineBtn, hangupBtn,
    speakerBtn, muteBtn, videoBtn, screenShareBtn, localVideo,
    toggleLocalViewBtn, toggleRemoteViewBtn, connectAudio,
    connectionStatus, connectionQuality,
    deviceSettingsBtn, deviceSettingsModal, closeSettingsBtns
} from './call_ui_elements.js';

import { initializeWebSocket } from './call_websocket.js';
import * as webrtc from './call_webrtc.js';
import * as media from './call_media.js';
import * as monitor from './call_connection_monitor.js';
import * as uiManager from './call_ui_manager.js';
import * as state from './call_state.js';
import * as handlers from './call_handlers.js'; // <-- НОВЫЙ ИМПОРТ

const tg = window.Telegram.WebApp;

// --- ФАЙЛ ОЧИЩЕН ОТ ЛОГИКИ ОБРАБОТЧИКОВ ---

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
            // sendMessage находится в websocket.js, его можно импортировать напрямую
            import('./call_websocket.js').then(({ sendMessage }) => {
                sendMessage({ type: 'connection_established', data: { type: type } });
            });
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
        onCallEndedByPeer: (reason) => handlers.endCall(false, reason),
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
    if (isMobileDevice() && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
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
        onUserList: (users) => {
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
        },
        onIncomingCall: handlers.handleIncomingCall,
        onCallAccepted: () => {
            document.getElementById('ringOutAudio').pause(); 
            document.getElementById('ringOutAudio').currentTime = 0;
            const localStream = media.getLocalStream();
            webrtc.startPeerConnection(state.getTargetUser().id, true, state.getState().currentCallType, localStream, state.getRtcConfig(), monitor.connectionLogger);
        },
        onOffer: (data) => {
            const localStream = media.getLocalStream();
            webrtc.handleOffer(data, localStream, state.getRtcConfig(), monitor.connectionLogger);
        },
        onAnswer: webrtc.handleAnswer,
        onCandidate: webrtc.handleCandidate,
        onCallEnded: () => handlers.endCall(false, 'ended_by_peer'),
        onCallMissed: () => {
            alert("Абонент не отвечает.");
            handlers.endCall(false, 'no_answer');
        },
        onRoomClosed: () => {
            alert("Комната для звонков была закрыта.");
            handlers.redirectToInvalidLink();
        },
        onFatalError: handlers.redirectToInvalidLink
    };
    initializeWebSocket(state.getRoomId(), wsHandlers, logToScreen);

    handlers.updateRoomLifetime();
    const timerId = setInterval(handlers.updateRoomLifetime, 60000);
    state.setLifetimeTimerInterval(timerId);
}

function setupEventListeners() {
    continueToCallBtn.addEventListener('click', () => proceedToCall(false));
    document.getElementById('continue-spectator-btn').addEventListener('click', () => proceedToCall(true));
    cameraSelect.addEventListener('change', updatePreviewStream);
    micSelect.addEventListener('change', updatePreviewStream);
    speakerSelect.addEventListener('change', updatePreviewStream);

    speakerBtn.addEventListener('click', handlers.toggleSpeaker);
    muteBtn.addEventListener('click', handlers.toggleMute);
    videoBtn.addEventListener('click', handlers.toggleVideo);
    screenShareBtn.addEventListener('click', () => {
        const { isVideoEnabled, currentCallType } = state.getState();
        webrtc.toggleScreenShare(media.getLocalStream(), (isSharing) => uiManager.updateScreenShareUI(isSharing, isVideoEnabled, currentCallType));
    });
    acceptBtn.addEventListener('click', handlers.acceptCall);
    declineBtn.addEventListener('click', handlers.declineCall);
    
    hangupBtn.addEventListener('click', () => handlers.endCall(true, 'cancelled_by_user'));
    
    closeSessionBtn.addEventListener('click', handlers.closeSession);

    instructionsBtn.addEventListener('click', () => instructionsModal.classList.add('active'));
    closeInstructionsBtns.forEach(btn => btn.addEventListener('click', () => instructionsModal.classList.remove('active')));

    deviceSettingsBtn.addEventListener('click', handlers.openDeviceSettings);
    closeSettingsBtns.forEach(btn => btn.addEventListener('click', () => deviceSettingsModal.classList.remove('active')));
    
    // Динамические селекторы в модальном окне
    document.getElementById('camera-select-call').addEventListener('change', (e) => handlers.switchInputDevice('video', e.target.value));
    document.getElementById('mic-select-call').addEventListener('change', (e) => handlers.switchInputDevice('audio', e.target.value));
    document.getElementById('speaker-select-call').addEventListener('change', (e) => handlers.switchAudioOutput(e.target.value));

    popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        const targetUser = state.getTargetUser();
        if (button && targetUser.id) {
            handlers.initiateCall(targetUser, button.dataset.callType);
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

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}