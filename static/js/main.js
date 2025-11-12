import * as stateManager from './call_state.js';
import * as uiManager from './call_ui_manager.js';
import * as media from './call_media.js';
import * as webrtc from './call_webrtc.js';
import * as monitor from './call_connection_monitor.js';
import * as orchestrator from './call_orchestrator.js';
import {
    previewVideo, micLevelBars, continueToCallBtn, cameraSelect, micSelect, speakerSelect,
    cameraSelectContainer, micSelectContainer, speakerSelectContainer
} from './call_ui_elements.js';

function logToServer(message) {
    const { currentUser, roomId } = stateManager.getState();
    if (!currentUser || !roomId) return;
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

function log(message) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const logMessage = `[${time}] ${message}`;
    console.log(logMessage);
    const prefixesToIgnore = ['[STATS]', '[DC]', '[WEBRTC]', '[PROBE]', '[SINK]', '[WS]', '[MEDIA]', '[CONTROLS]'];
    const shouldSendToServer = !prefixesToIgnore.some(prefix => message.startsWith(prefix));
    if (shouldSendToServer) logToServer(logMessage);
}

function loadIcons() {
    const iconPlaceholders = document.querySelectorAll('[data-icon-name]');
    if (typeof ICONS === 'undefined') return;
    iconPlaceholders.forEach(placeholder => {
        const iconName = placeholder.dataset.iconName;
        if (ICONS[iconName]) placeholder.innerHTML = ICONS[iconName];
    });
}

async function fetchRtcConfig() {
    try {
        log("Fetching ICE servers configuration from server...");
        const response = await fetch('/api/ice-servers');
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        const servers = await response.json();
        
        const peerConnectionConfig = servers.map(s => ({
            urls: s.urls,
            username: s.username,
            credential: s.credential
        }));
        const rtcConfig = { iceServers: peerConnectionConfig, iceCandidatePoolSize: 10 };

        const iceServerDetails = {};
        servers.forEach(s => {
            let provider = s.provider || 'Unknown';
            iceServerDetails[s.urls] = { region: s.region || 'global', provider };
        });

        log("ICE servers configuration and details loaded successfully.");
        return { rtcConfig, iceServerDetails };
    } catch (error) {
        log(`[CRITICAL] Failed to fetch ICE servers: ${error.message}.`);
        alert("Не удалось загрузить конфигурацию сети. Качество звонка может быть низким.");
        return { rtcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }, iceServerDetails: {} };
    }
}

async function runPreCallCheck() {
    uiManager.showScreen('pre-call-check');
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        document.getElementById('ios-audio-permission-note').style.display = 'block';
    }
    
    const { hasCameraAccess, hasMicrophoneAccess } = await media.initializePreview(previewVideo, micLevelBars);
    if (!hasCameraAccess || !hasMicrophoneAccess) uiManager.displayMediaErrors();
    uiManager.updateStatusIndicators(hasCameraAccess, hasMicrophoneAccess);

    if (hasCameraAccess || hasMicrophoneAccess) {
        const selectedIds = await media.populateDeviceSelectors(
            cameraSelect, micSelect, speakerSelect,
            cameraSelectContainer, micSelectContainer, speakerSelectContainer
        );
        stateManager.setState({
            selectedVideoId: selectedIds.videoId,
            selectedAudioInId: selectedIds.audioInId,
            selectedAudioOutId: selectedIds.audioOutId
        });
        continueToCallBtn.disabled = false;
    }
}

async function updateRoomLifetime() {
    const { roomId, lifetimeTimerInterval } = stateManager.getState();
    try {
        const response = await fetch(`/room/lifetime/${roomId}`);
        if (!response.ok) throw new Error('Room not found or expired on server.');
        const data = await response.json();
        const isStillValid = uiManager.updateRoomLifetimeUI(data.remaining_seconds);
        if (!isStillValid) {
            clearInterval(lifetimeTimerInterval);
            alert("Время жизни ссылки истекло.");
            uiManager.redirectToInvalidLink();
        }
    } catch (error) {
        log(`[LIFETIME] Error fetching lifetime: ${error.message}`);
        clearInterval(lifetimeTimerInterval);
    }
}

async function initializeApp() {
    loadIcons();
    const path = window.location.pathname;
    if (!path.startsWith('/call/')) return;
    
    const roomId = path.split('/')[2];
    const { rtcConfig, iceServerDetails } = await fetchRtcConfig();
    
    stateManager.initializeState({ roomId, rtcConfig, iceServerDetails });
    
    media.init(log);
    
    monitor.init({
        log: log,
        getPeerConnection: webrtc.getPeerConnection,
        updateConnectionIcon: uiManager.updateConnectionIcon,
        updateConnectionQualityIcon: uiManager.updateConnectionQualityIcon,
        showConnectionToast: uiManager.showConnectionToast,
        getIceServerDetails: () => stateManager.getState().iceServerDetails,
        getRtcConfig: () => stateManager.getState().rtcConfig,
        onConnectionEstablished: (type) => sendMessage({ type: 'connection_established', data: { type: type } })
    });

    webrtc.init({
        log: log,
        onCallConnected: () => {
            uiManager.showCallingOverlay(false);
            uiManager.showScreen('call');
            const { currentCallType, targetUser } = stateManager.getState();
            const mediaStatus = media.getMediaAccessStatus();
            uiManager.updateCallUI(currentCallType, targetUser, mediaStatus, ('ontouchstart' in window));
            
            let seconds = 0;
            const timerInterval = uiManager.startCallTimer(currentCallType, () => {
                seconds++;
                uiManager.updateTimerDisplay(seconds);
            });
            stateManager.setState({ callTimerInterval: timerInterval });

            uiManager.playAudio('connect');
            monitor.startConnectionMonitoring();
        },
        onCallEndedByPeer: (reason) => orchestrator.endCall(false, reason),
        onRemoteTrack: (stream) => media.visualizeRemoteMic(stream),
        onRemoteMuteStatus: uiManager.handleRemoteMuteStatus,
        getTargetUser: () => stateManager.getState().targetUser,
        getSelectedAudioOutId: () => stateManager.getState().selectedAudioOutId,
        getCurrentConnectionType: monitor.getCurrentConnectionType,
        isVideoEnabled: () => stateManager.getState().isVideoEnabled,
    });

    orchestrator.initialize(log);
    uiManager.setupGlobalEventHandlers();

    continueToCallBtn.addEventListener('click', () => {
        stateManager.setState({ isSpectator: false });
        media.stopPreviewStream();
        uiManager.showScreen('pre-call');
        uiManager.showPreCallPopup('waiting');
        updateRoomLifetime();
        stateManager.setState({ lifetimeTimerInterval: setInterval(updateRoomLifetime, 60000) });
    });
    document.getElementById('continue-spectator-btn').addEventListener('click', () => {
        stateManager.setState({ isSpectator: true });
        media.stopPreviewStream();
        uiManager.showScreen('pre-call');
        uiManager.showPreCallPopup('waiting');
    });

    const onDeviceChange = async () => {
        const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
        const constraints = {
            audio: hasMicrophoneAccess ? { deviceId: { exact: cameraSelect.value } } : false,
            video: hasCameraAccess ? { deviceId: { exact: micSelect.value } } : false
        };
        await media.updatePreviewStream(constraints, previewVideo, micLevelBars);
        stateManager.setState({
            selectedVideoId: cameraSelect.value,
            selectedAudioInId: micSelect.value,
            selectedAudioOutId: speakerSelect.value
        });
    };
    cameraSelect.addEventListener('change', onDeviceChange);
    micSelect.addEventListener('change', onDeviceChange);
    speakerSelect.addEventListener('change', onDeviceChange);

    runPreCallCheck();
}

document.addEventListener('DOMContentLoaded', initializeApp);