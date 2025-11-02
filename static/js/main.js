// static/js/main.js

import * as uiElements from './call_ui_elements.js';
import { initializeWebSocket, sendMessage, setGracefulDisconnect } from './call_websocket.js';
import * as webrtc from './call_webrtc.js';
import * as media from './call_media.js';
import * as monitor from './call_connection_monitor.js';
import * as ui from './call_ui_manager.js';

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
let selectedVideoId = null;
let selectedAudioInId = null;
let selectedAudioOutId = null;
let iceServerDetails = {};
let isCallInitiator = false;
let isEndingCall = false;

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
    const path = window.location.pathname;
    logToScreen(`App loaded. Path: ${path}`);

    try {
        logToScreen("Fetching ICE servers configuration from server...");
        const response = await fetch('/api/ice-servers');
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        const servers = await response.json();
        
        rtcConfig = { iceServers: servers.map(s => ({
            urls: s.urls,
            username: s.username,
            credential: s.credential
        })), iceCandidatePoolSize: 10 };

        servers.forEach(s => {
            let provider = 'Unknown';
            if (s.source) {
                try { provider = new URL(s.source).hostname.replace(/^www\./, ''); } catch (e) { provider = s.source; }
            } else if (s.provider) { provider = s.provider; }
            iceServerDetails[s.urls] = { region: s.region || 'global', provider: provider };
        });
        logToScreen("ICE servers configuration and details loaded successfully.");
    } catch (error) {
        logToScreen(`[CRITICAL] Failed to fetch ICE servers: ${error.message}. Falling back to public STUN.`);
        alert("Не удалось загрузить конфигурацию сети. Качество звонка может быть низким.");
        rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
    }

    if (path.startsWith('/call/')) {
        roomId = path.split('/')[2];
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
        updateConnectionIcon: ui.updateConnectionIcon,
        updateConnectionQualityIcon: ui.updateConnectionQualityIcon,
        showConnectionToast: ui.showConnectionToast,
        getIceServerDetails: () => iceServerDetails,
        getRtcConfig: () => rtcConfig
    });

    webrtc.init({
        log: logToScreen,
        onCallConnected: () => {
            if (!uiElements.callScreen.classList.contains('active')) {
                ui.showScreen('call');
                updateCallUI();
            }
            ui.startTimer();
            uiElements.connectAudio.play();
        },
        onCallEndedByPeer: (reason) => endCall(false, reason),
        onRemoteTrack: (stream) => media.visualizeRemoteMic(stream),
        onRemoteMuteStatus: ui.handleRemoteMuteStatus,
        getTargetUser: () => targetUser,
        getSelectedAudioOutId: () => selectedAudioOutId,
        getCurrentConnectionType: monitor.getCurrentConnectionType,
        isVideoEnabled: () => isVideoEnabled,
    });

    const uiHandlers = {
        onProceedToCall: proceedToCall,
        onUpdatePreviewStream: updatePreviewStream,
        onToggleSpeaker: toggleSpeaker,
        onToggleMute: toggleMute,
        onToggleVideo: toggleVideo,
        onToggleScreenShare: () => webrtc.toggleScreenShare(media.getLocalStream(), updateScreenShareUI),
        onAcceptCall: acceptCall,
        onDeclineCall: declineCall,
        onEndCall: endCall,
        onCloseSession: closeSession,
        onOpenDeviceSettings: openDeviceSettings,
        onSwitchInputDevice: switchInputDevice,
        onSwitchAudioOutput: switchAudioOutput,
        onInitiateCall: (callType) => initiateCall(targetUser, callType),
        onShowConnectionInfo: () => ui.showConnectionInfo(monitor.getCurrentConnectionDetails()),
    };
    ui.init(uiHandlers);

    runPreCallCheck();
}

async function runPreCallCheck() {
    ui.showScreen('pre-call-check');
    
    const { hasCameraAccess, hasMicrophoneAccess } = await media.initializePreview(uiElements.previewVideo, uiElements.micLevelBars);

    if (!hasCameraAccess || !hasMicrophoneAccess) {
        uiElements.continueSpectatorBtn.style.display = 'block';
    }

    ui.updateStatusIndicators(hasCameraAccess, hasMicrophoneAccess);

    if (hasCameraAccess || hasMicrophoneAccess) {
        const selectedIds = await media.populateDeviceSelectors(
            uiElements.cameraSelect, uiElements.micSelect, uiElements.speakerSelect,
            uiElements.cameraSelectContainer, uiElements.micSelectContainer, uiElements.speakerSelectContainer
        );
        selectedVideoId = selectedIds.videoId;
        selectedAudioInId = selectedIds.audioInId;
        selectedAudioOutId = selectedIds.audioOutId;
        uiElements.continueToCallBtn.disabled = false;
    } else {
        logToScreen('[MEDIA_CHECK] No media devices available or access denied to all.');
    }
}

async function updatePreviewStream() {
    selectedVideoId = uiElements.cameraSelect.value;
    selectedAudioInId = uiElements.micSelect.value;
    selectedAudioOutId = uiElements.speakerSelect.value;
    
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
        video: hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
    };
    await media.updatePreviewStream(constraints, uiElements.previewVideo, uiElements.micLevelBars);
}

function proceedToCall(asSpectator = false) {
    isSpectator = asSpectator;
    logToScreen(`Proceeding to call screen. Spectator mode: ${isSpectator}`);
    media.stopPreviewStream();

    ui.showScreen('pre-call');
    ui.showPopup('waiting');
    
    const wsHandlers = {
        onIdentity: (data) => {
            currentUser.id = data.id;
            logToScreen(`[WS] Identity assigned by server: ${currentUser.id}`);
        },
        onUserList: handleUserList,
        onIncomingCall: handleIncomingCall,
        onCallAccepted: () => {
            uiElements.ringOutAudio.pause(); 
            uiElements.ringOutAudio.currentTime = 0;
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
        ui.showPopup('waiting');
    } else {
        targetUser = otherUsers[0];
        if (targetUser.status === 'busy') {
            ui.showPopup('initiating');
        } else {
            ui.showPopup('actions');
        }
    }
}

async function initiateCall(userToCall, callType) {
    logToScreen(`[CALL] Initiating call to user ${userToCall.id}, type: ${callType}`);
    isCallInitiator = true;
    currentCallType = callType;
    
    if (currentCallType === 'video') {
        uiElements.remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType === 'video');
    if (!hasMedia) logToScreen("[CALL] Proceeding with call without local media.");

    targetUser = userToCall;

    monitor.connectionLogger.reset(roomId, currentUser.id, isCallInitiator);
    const probeResults = await monitor.probeIceServers();
    monitor.connectionLogger.setProbeResults(probeResults);

    sendMessage({ type: 'call_user', data: { target_id: targetUser.id, call_type: currentCallType } });

    ui.showScreen('call');
    updateCallUI();
    ui.setCallStatusRinging();
    uiElements.ringOutAudio.play();
}

function handleIncomingCall(data) {
    logToScreen(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    isCallInitiator = false;
    targetUser = data.from_user;
    currentCallType = data.call_type;

    ui.updateIncomingCallModal(targetUser, currentCallType);
    ui.showModal('incoming-call', true);
    uiElements.ringInAudio.play();
}

async function acceptCall() {
    logToScreen("[CALL] 'Accept' button pressed.");
    stopIncomingRing();
    ui.showModal('incoming-call', false);

    if (currentCallType === 'video') {
        uiElements.remoteVideo.play().catch(() => {});
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
    ui.showModal('incoming-call', false);
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

    uiElements.connectionQuality.classList.remove('active');
    monitor.stopConnectionMonitoring();

    webrtc.endPeerConnection();
    media.stopAllStreams();

    uiElements.ringOutAudio.pause(); uiElements.ringOutAudio.currentTime = 0;
    stopIncomingRing();

    uiElements.localAudio.srcObject = null;
    uiElements.localVideo.srcObject = null;
    uiElements.localVideoContainer.style.display = 'none';
    uiElements.remoteVideo.style.display = 'none';
    
    ui.stopTimer();
    ui.showModal('incoming-call', false);
    ui.showScreen('pre-call');

    targetUser = {};
    ui.resetCallControls();
    isEndingCall = false;
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

    const result = await media.getStreamForCall(constraints, uiElements.localVideo, uiElements.localAudio);
    
    if (result.stream) {
        isVideoEnabled = result.isVideo;
        if (!result.isVideo && constraints.video) {
            logToScreen("[MEDIA] WARNING: Video requested but no video track found.");
            currentCallType = 'audio';
        }
        return true;
    }
    return false;
}

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function stopIncomingRing() {
    uiElements.ringInAudio.pause();
    uiElements.ringInAudio.currentTime = 0;
}

function updateCallUI() {
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    ui.updateCallUI(targetUser, currentCallType, hasCameraAccess, hasMicrophoneAccess, isMobileDevice());
}

function toggleMute() {
    if (!media.getMediaAccessStatus().hasMicrophoneAccess) return;
    isMuted = !isMuted;
    webrtc.toggleMute(isMuted, media.getLocalStream());
    ui.updateMuteButton(isMuted);
    logToScreen(`[CONTROLS] Mic ${isMuted ? 'muted' : 'unmuted'}.`);
}

function toggleSpeaker() {
    isSpeakerMuted = media.toggleRemoteSpeakerMute();
    ui.updateSpeakerButton(isSpeakerMuted);
    logToScreen(`[CONTROLS] Remote audio (speaker) ${isSpeakerMuted ? 'muted' : 'unmuted'}.`);
}

function toggleVideo() {
    if (!media.getMediaAccessStatus().hasCameraAccess) return;
    isVideoEnabled = !isVideoEnabled;
    webrtc.toggleVideo(isVideoEnabled, media.getLocalStream());
    ui.updateVideoButton(isVideoEnabled);
    logToScreen(`[CONTROLS] Video ${isVideoEnabled ? 'enabled' : 'disabled'}.`);
}

async function openDeviceSettings() {
    await populateDeviceSelectorsInCall();
    ui.openDeviceSettingsModal();
}

async function populateDeviceSelectorsInCall() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const audioInDevices = devices.filter(d => d.kind === 'audioinput');
    const audioOutDevices = devices.filter(d => d.kind === 'audiooutput');

    const localStream = media.getLocalStream();
    const currentAudioTrack = localStream?.getAudioTracks()[0];
    const currentVideoTrack = localStream?.getVideoTracks()[0];
    
    const currentIds = {
        currentAudioTrackId: currentAudioTrack?.getSettings().deviceId,
        currentVideoTrackId: currentVideoTrack?.getSettings().deviceId
    };

    ui.populateDeviceSelectorsInCall(
        { videoDevices, audioInDevices, audioOutDevices },
        currentIds,
        uiElements.remoteVideo.sinkId
    );
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
    if (typeof uiElements.remoteVideo.setSinkId !== 'function') {
        logToScreen('[SINK] setSinkId() is not supported by this browser.');
        return;
    }
    try {
        await uiElements.remoteVideo.setSinkId(deviceId);
        await uiElements.remoteAudio.setSinkId(deviceId);
        selectedAudioOutId = deviceId;
        logToScreen(`[SINK] Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        logToScreen(`[SINK] Error switching audio output: ${error}`);
    }
}

function updateScreenShareUI(isSharing) {
    ui.updateScreenShareButton(isSharing, isVideoEnabled, currentCallType);
}

async function updateRoomLifetime() {
    try {
        const response = await fetch(`/room/lifetime/${roomId}`);
        if (!response.ok) throw new Error('Room not found or expired on server.');
        const data = await response.json();
        const isTimeRemaining = ui.updateLifetimeTimer(data.remaining_seconds);
        if (!isTimeRemaining) {
            clearInterval(lifetimeTimerInterval);
            alert("Время жизни ссылки истекло.");
            redirectToInvalidLink();
        }
    } catch (error) {
        logToScreen(`[LIFETIME] Error fetching lifetime: ${error.message}`);
        ui.setLifetimeTimerError();
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