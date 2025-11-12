import * as state from './call_state.js';
import * as uiManager from './call_ui_manager.js';
import * as media from './call_media.js';
import * as webrtc from './call_webrtc.js';
import * as monitor from './call_connection_monitor.js';
import { CallRecorder } from './call_recorder.js';
import { initializeWebSocket, sendMessage, setGracefulDisconnect } from './call_websocket.js';
import {
    previewVideo, micLevelBars, continueToCallBtn, cameraSelect, micSelect, speakerSelect,
    cameraSelectContainer, micSelectContainer, speakerSelectContainer, popupActions,
    closeSessionBtn, instructionsBtn, acceptBtn, declineBtn, hangupBtn, speakerBtn,
    muteBtn, videoBtn, screenShareBtn, localVideo, remoteVideo, localVideoContainer,
    toggleLocalViewBtn, toggleRemoteViewBtn, connectionStatus, deviceSettingsBtn,
    cameraSelectCall, micSelectCall, speakerSelectCall
} from './call_ui_elements.js';

let localRecorder = null;
let remoteRecorder = null;

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function sendLogToServer(message) {
    const s = state.getState();
    if (!s.currentUser || !s.currentUser.id || !s.roomId) return;
    fetch('/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: String(s.currentUser.id || 'pre-id'),
            room_id: String(s.roomId),
            message: message
        })
    }).catch(error => console.error('Failed to send log to server:', error));
}

function logToScreen(message) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const logMessage = `[${time}] ${message}`;
    console.log(logMessage);
    const prefixesToIgnore = ['[STATS]', '[DC]', '[WEBRTC]', '[PROBE]', '[SINK]', '[WS]', '[MEDIA]', '[CONTROLS]'];
    const shouldSendToServer = !prefixesToIgnore.some(prefix => message.startsWith(prefix));
    if (shouldSendToServer) {
        sendLogToServer(logMessage);
    }
}

async function runPreCallCheck() {
    uiManager.showScreen('pre-call-check');
    if (isIOS()) {
        document.getElementById('ios-audio-permission-note').style.display = 'block';
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
    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: state.getState().selectedAudioInId } } : false,
        video: hasCameraAccess ? { deviceId: { exact: state.getState().selectedVideoId } } : false
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
            state.setCurrentUser({ id: data.id });
            logToScreen(`[WS] Identity assigned by server: ${state.getState().currentUser.id}`);
        },
        onUserList: handleUserList,
        onIncomingCall: handleIncomingCall,
        onCallAccepted: () => {
            uiManager.stopRingOutSound();
            const localStream = media.getLocalStream();
            webrtc.startPeerConnection(state.getState().targetUser.id, true, state.getState().currentCallType, localStream, state.getState().rtcConfig, monitor.connectionLogger);
        },
        onOffer: (data) => {
            const localStream = media.getLocalStream();
            webrtc.handleOffer(data, localStream, state.getState().rtcConfig, monitor.connectionLogger);
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
    initializeWebSocket(state.getState().roomId, wsHandlers, logToScreen);
    updateRoomLifetime();
    state.setLifetimeTimerInterval(setInterval(updateRoomLifetime, 60000));
}

function handleUserList(users) {
    const otherUsers = users.filter(u => u.id !== state.getState().currentUser.id);
    if (otherUsers.length === 0) {
        state.setTargetUser({});
        uiManager.showPopup('waiting');
    } else {
        state.setTargetUser(otherUsers[0]);
        if (state.getState().targetUser.status === 'busy') {
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
    monitor.connectionLogger.reset(state.getState().roomId, state.getState().currentUser.id, true);
    const probeResults = await monitor.probeIceServers();
    monitor.connectionLogger.setProbeResults(probeResults);
    sendMessage({ type: 'call_user', data: { target_id: state.getState().targetUser.id, call_type: callType } });
    uiManager.showScreen('call');
    const mediaStatus = media.getMediaAccessStatus();
    uiManager.updateCallUI(callType, state.getState().targetUser, mediaStatus, isMobileDevice());
    uiManager.showCallingOverlay(true, callType);
    uiManager.playRingOutSound();
}

function handleIncomingCall(data) {
    logToScreen(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    state.setIsCallInitiator(false);
    state.setTargetUser(data.from_user);
    state.setCurrentCallType(data.call_type);
    uiManager.showIncomingCall(data.from_user?.first_name || 'Собеседник', data.call_type);
}

async function acceptCall() {
    logToScreen("[CALL] 'Accept' button pressed.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    if (state.getState().currentCallType === 'video') {
        remoteVideo.play().catch(() => {});
    }
    const hasMedia = await initializeLocalMedia(state.getState().currentCallType);
    if (!hasMedia) logToScreen("[CALL] No local media available, accepting as receive-only.");
    logToScreen("[CALL] Starting WebRTC connection.");
    monitor.connectionLogger.reset(state.getState().roomId, state.getState().currentUser.id, false);
    const localStream = media.getLocalStream();
    await webrtc.startPeerConnection(state.getState().targetUser.id, false, state.getState().currentCallType, localStream, state.getState().rtcConfig, monitor.connectionLogger);
    sendMessage({ type: 'call_accepted', data: { target_id: state.getState().targetUser.id } });
}

function declineCall() {
    logToScreen("[CALL] Declining call.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    sendMessage({ type: 'call_declined', data: { target_id: state.getState().targetUser.id } });
    state.setTargetUser({});
}

async function uploadRecordings() {
    if (!state.getState().isRecordingEnabled) return;

    logToScreen('[RECORDER] Stopping and uploading recordings...');
    const [localBlob, remoteBlob] = await Promise.all([
        localRecorder ? localRecorder.stop() : Promise.resolve(null),
        remoteRecorder ? remoteRecorder.stop() : Promise.resolve(null)
    ]);

    const s = state.getState();
    const upload = (blob, type) => {
        if (!blob || blob.size === 0) {
            logToScreen(`[RECORDER] No data to upload for ${type} stream.`);
            return Promise.resolve();
        }
        const formData = new FormData();
        formData.append('room_id', s.roomId);
        formData.append('user_id', s.currentUser.id);
        formData.append('record_type', type);
        formData.append('file', blob, `${type}.webm`);

        return fetch('/api/record/upload', {
            method: 'POST',
            body: formData
        }).then(response => {
            if (response.ok) logToScreen(`[RECORDER] ${type} recording uploaded successfully.`);
            else logToScreen(`[RECORDER] Failed to upload ${type} recording.`);
        }).catch(err => logToScreen(`[RECORDER] Upload error for ${type}: ${err}`));
    };

    await Promise.all([upload(localBlob, 'local'), upload(remoteBlob, 'remote')]);
    
    localRecorder = null;
    remoteRecorder = null;
}

async function endCall(isInitiatorOfHangup, reason) {
    if (state.getState().isEndingCall) return;
    state.setIsEndingCall(true);
    hangupBtn.disabled = true;
    logToScreen(`[CALL] Ending call. Initiator of hangup: ${isInitiatorOfHangup}, Reason: ${reason}`);
    
    await uploadRecordings();

    setGracefulDisconnect(true);
    if (isInitiatorOfHangup && state.getState().targetUser.id) {
        sendMessage({ type: 'hangup', data: { target_id: state.getState().targetUser.id } });
    }
    if (isInitiatorOfHangup && !monitor.connectionLogger.isDataSent) {
        monitor.connectionLogger.sendProbeLog();
    }
    monitor.stopConnectionMonitoring();
    webrtc.endPeerConnection();
    media.stopAllStreams();
    uiManager.stopAllSounds();
    uiManager.cleanupAfterCall(state.getState().callTimerInterval);
    state.setCallTimerInterval(null);
    state.resetCallState();
    hangupBtn.disabled = false;
}

async function initializeLocalMedia(callType) {
    if (state.getState().isSpectator) {
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
    const s = state.getState();
    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: s.selectedAudioInId } } : false,
        video: isVideoCall && hasCameraAccess ? { deviceId: { exact: s.selectedVideoId } } : false
    };
    const result = await media.getStreamForCall(constraints, localVideo, document.getElementById('localAudio'));
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

function toggleMute() {
    if (!media.getMediaAccessStatus().hasMicrophoneAccess) return;
    const newMuteState = !state.getState().isMuted;
    state.setIsMuted(newMuteState);
    webrtc.toggleMute(newMuteState, media.getLocalStream());
    muteBtn.classList.toggle('active', newMuteState);
    logToScreen(`[CONTROLS] Mic ${newMuteState ? 'muted' : 'unmuted'}.`);
}

function toggleSpeaker() {
    const newSpeakerMuteState = media.toggleRemoteSpeakerMute();
    state.setIsSpeakerMuted(newSpeakerMuteState);
    speakerBtn.classList.toggle('active', newSpeakerMuteState);
    logToScreen(`[CONTROLS] Remote audio (speaker) ${newSpeakerMuteState ? 'muted' : 'unmuted'}.`);
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
        await document.getElementById('remoteAudio').setSinkId(deviceId);
        state.setSelectedAudioOutId(deviceId);
        logToScreen(`[SINK] Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        logToScreen(`[SINK] Error switching audio output: ${error}`);
        alert(`Не удалось переключить динамик: ${error.message}`);
    }
}

async function updateRoomLifetime() {
    try {
        const response = await fetch(`/room/lifetime/${state.getState().roomId}`);
        if (!response.ok) throw new Error('Room not found or expired on server.');
        const data = await response.json();
        uiManager.updateLifetimeDisplay(data.remaining_seconds, () => {
            clearInterval(state.getState().lifetimeTimerInterval);
            alert("Время жизни ссылки истекло.");
            redirectToInvalidLink();
        });
    } catch (error) {
        logToScreen(`[LIFETIME] Error fetching lifetime: ${error.message}`);
        uiManager.updateLifetimeDisplay(-1);
        clearInterval(state.getState().lifetimeTimerInterval);
    }
}

async function closeSession() {
    logToScreen("[SESSION] User clicked close session button.");
    setGracefulDisconnect(true);
    try {
        await fetch(`/room/close/${state.getState().roomId}`, { method: 'POST' });
    } catch (error) {
        logToScreen(`[SESSION] Error sending close request: ${error}`);
        alert("Не удалось закрыть сессию. Попробуйте обновить страницу.");
    }
}

function redirectToInvalidLink() {
    setGracefulDisconnect(true);
    window.location.reload();
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
    screenShareBtn.addEventListener('click', () => webrtc.toggleScreenShare(media.getLocalStream(), (isSharing) => uiManager.updateScreenShareUI(isSharing, state.getState().isVideoEnabled, state.getState().currentCallType)));
    acceptBtn.addEventListener('click', acceptCall);
    declineBtn.addEventListener('click', declineCall);
    hangupBtn.addEventListener('click', () => {
        const isThisUserInitiator = state.getState().isCallInitiator;
        endCall(isThisUserInitiator, 'cancelled_by_user');
    });
    closeSessionBtn.addEventListener('click', closeSession);
    instructionsBtn.addEventListener('click', () => uiManager.showModal('instructions', true));
    document.querySelectorAll('.close-instructions-btn').forEach(btn => btn.addEventListener('click', () => uiManager.showModal('instructions', false)));
    deviceSettingsBtn.addEventListener('click', () => uiManager.openDeviceSettingsModal(media.getLocalStream(), state.getState()));
    document.querySelectorAll('.close-settings-btn').forEach(btn => btn.addEventListener('click', () => uiManager.showModal('device-settings', false)));
    cameraSelectCall.addEventListener('change', (e) => switchInputDevice('video', e.target.value));
    micSelectCall.addEventListener('change', (e) => switchInputDevice('audio', e.target.value));
    speakerSelectCall.addEventListener('change', (e) => switchAudioOutput(e.target.value));
    popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        if (button && state.getState().targetUser.id) {
            initiateCall(state.getState().targetUser, button.dataset.callType);
        }
    });
    toggleLocalViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiManager.toggleLocalVideoView();
    });
    toggleRemoteViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiManager.toggleRemoteVideoView();
    });
    connectionStatus.addEventListener('click', () => {
        const details = monitor.getCurrentConnectionDetails();
        uiManager.showConnectionInfo(details);
    });
    uiManager.setupLocalVideoInteraction();
}

export function initialize(roomId, rtcConfig, iceServerDetails, isRecordingEnabled) {
    logToScreen(`Initializing in Private Call mode for room: ${roomId}`);
    state.setRoomId(roomId);
    state.setRtcConfig(rtcConfig);
    state.setIceServerDetails(iceServerDetails);
    state.setIsRecordingEnabled(isRecordingEnabled);

    media.init(logToScreen);
    monitor.init({
        log: logToScreen,
        getPeerConnection: webrtc.getPeerConnection,
        updateConnectionIcon: uiManager.updateConnectionIcon,
        updateConnectionQualityIcon: uiManager.updateConnectionQualityIcon,
        showConnectionToast: uiManager.showConnectionToast,
        getIceServerDetails: () => state.getState().iceServerDetails,
        getRtcConfig: () => state.getState().rtcConfig,
        onConnectionEstablished: (type) => {
            sendMessage({ type: 'connection_established', data: { type: type } });
        }
    });
    webrtc.init({
        log: logToScreen,
        onCallConnected: () => {
            uiManager.showCallingOverlay(false);
            uiManager.showScreen('call');
            const mediaStatus = media.getMediaAccessStatus();
            const s = state.getState();
            uiManager.updateCallUI(s.currentCallType, s.targetUser, mediaStatus, isMobileDevice());
            state.setCallTimerInterval(uiManager.startCallTimer(s.currentCallType));
            monitor.startConnectionMonitoring();
            
            if (s.isRecordingEnabled) {
                const localStream = media.getLocalStream();
                const remoteStream = webrtc.getRemoteStream();
                if (localStream && localStream.getAudioTracks().length > 0) {
                    localRecorder = new CallRecorder(new MediaStream(localStream.getAudioTracks()), logToScreen);
                    localRecorder.start();
                }
                if (remoteStream && remoteStream.getAudioTracks().length > 0) {
                    remoteRecorder = new CallRecorder(new MediaStream(remoteStream.getAudioTracks()), logToScreen);
                    remoteRecorder.start();
                }
            }
        },
        onCallEndedByPeer: (reason) => endCall(false, reason),
        onRemoteTrack: (stream) => media.visualizeRemoteMic(stream),
        onRemoteMuteStatus: uiManager.handleRemoteMuteStatus,
        getTargetUser: () => state.getState().targetUser,
        getSelectedAudioOutId: () => state.getState().selectedAudioOutId,
        getCurrentConnectionType: monitor.getCurrentConnectionType,
        isVideoEnabled: () => state.getState().isVideoEnabled,
    });

    setupEventListeners();
    runPreCallCheck();
}