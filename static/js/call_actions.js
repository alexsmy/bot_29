import * as state from './call_state.js';
import * as uiManager from './call_ui_manager.js';
import * as media from './call_media.js';
import * as webrtc from './call_webrtc.js';
import * as monitor from './call_connection_monitor.js';
import { CallRecorder } from './call_recorder.js';
import { initializeWebSocket, sendMessage, setGracefulDisconnect } from './call_websocket.js';
import { log } from './call_logger.js';
import {
    previewVideo, micLevelBars, remoteVideo, localVideo, localVideoContainer, hangupBtn
} from './call_ui_elements.js';

let localRecorder = null;

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function redirectToInvalidLink() {
    setGracefulDisconnect(true);
    window.location.reload();
}

/**
 * Запускает начальную проверку оборудования (камера, микрофон).
 */
export async function runPreCallCheck() {
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
            document.getElementById('camera-select'), document.getElementById('mic-select'), document.getElementById('speaker-select'),
            document.getElementById('camera-select-container'), document.getElementById('mic-select-container'), document.getElementById('speaker-select-container')
        );
        state.setSelectedVideoId(selectedIds.videoId);
        state.setSelectedAudioInId(selectedIds.audioInId);
        state.setSelectedAudioOutId(selectedIds.audioOutId);
        document.getElementById('continue-to-call-btn').disabled = false;
    } else {
        log('[MEDIA_CHECK] No media devices available or access denied to all.');
    }
}

/**
 * Обновляет поток с превью при смене устройства в настройках.
 */
export async function updatePreviewStream() {
    state.setSelectedVideoId(document.getElementById('camera-select').value);
    state.setSelectedAudioInId(document.getElementById('mic-select').value);
    state.setSelectedAudioOutId(document.getElementById('speaker-select').value);
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: state.getState().selectedAudioInId } } : false,
        video: hasCameraAccess ? { deviceId: { exact: state.getState().selectedVideoId } } : false
    };
    await media.updatePreviewStream(constraints, previewVideo, micLevelBars);
}

/**
 * Переходит к экрану ожидания/звонка и инициализирует WebSocket.
 * @param {boolean} asSpectator - Входит ли пользователь как наблюдатель.
 */
export function proceedToCall(asSpectator = false) {
    state.setIsSpectator(asSpectator);
    log(`Proceeding to call screen. Spectator mode: ${asSpectator}`);
    media.stopPreviewStream();
    uiManager.showScreen('pre-call');
    uiManager.showPopup('waiting');
    
    const wsHandlers = {
        onIdentity: (data) => {
            state.setCurrentUser({ id: data.id });
            log(`[WS] Identity assigned by server: ${state.getState().currentUser.id}`);
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
    
    initializeWebSocket(state.getState().roomId, wsHandlers, log);
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

/**
 * Инициирует звонок указанному пользователю.
 * @param {object} userToCall - Объект пользователя, которому звонят.
 * @param {string} callType - 'audio' или 'video'.
 */
export async function initiateCall(userToCall, callType) {
    log(`[CALL] Initiating call to user ${userToCall.id}, type: ${callType}`);
    state.setIsCallInitiator(true);
    state.setCurrentCallType(callType);
    if (callType === 'video') {
        remoteVideo.play().catch(() => {});
    }
    const hasMedia = await initializeLocalMedia(callType);
    if (!hasMedia) log("[CALL] Proceeding with call without local media.");
    
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
    log(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    state.setIsCallInitiator(false);
    state.setTargetUser(data.from_user);
    state.setCurrentCallType(data.call_type);
    uiManager.showIncomingCall(data.from_user?.first_name || 'Собеседник', data.call_type);
}

/**
 * Принимает входящий звонок.
 */
export async function acceptCall() {
    log("[CALL] 'Accept' button pressed.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    if (state.getState().currentCallType === 'video') {
        remoteVideo.play().catch(() => {});
    }
    const hasMedia = await initializeLocalMedia(state.getState().currentCallType);
    if (!hasMedia) log("[CALL] No local media available, accepting as receive-only.");
    
    log("[CALL] Starting WebRTC connection.");
    monitor.connectionLogger.reset(state.getState().roomId, state.getState().currentUser.id, false);
    const localStream = media.getLocalStream();
    await webrtc.startPeerConnection(state.getState().targetUser.id, false, state.getState().currentCallType, localStream, state.getState().rtcConfig, monitor.connectionLogger);
    
    sendMessage({ type: 'call_accepted', data: { target_id: state.getState().targetUser.id } });
}

/**
 * Отклоняет входящий звонок.
 */
export function declineCall() {
    log("[CALL] Declining call.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    sendMessage({ type: 'call_declined', data: { target_id: state.getState().targetUser.id } });
    state.setTargetUser({});
}

function uploadRecordings() {
    if (!state.getState().isRecordingEnabled || !localRecorder) {
        return Promise.resolve();
    }
    log('[RECORDER] Stopping and uploading local recording...');
    
    const upload = (blob) => {
        if (!blob || blob.size === 0) {
            log(`[RECORDER] No data to upload.`);
            return Promise.resolve();
        }
        const s = state.getState();
        const formData = new FormData();
        formData.append('room_id', s.roomId);
        formData.append('user_id', s.currentUser.id);
        formData.append('file', blob, `recording.webm`);

        return fetch('/api/record/upload', {
            method: 'POST',
            body: formData
        }).then(response => {
            if (response.ok) log(`[RECORDER] Local recording uploaded successfully.`);
            else log(`[RECORDER] Failed to upload local recording.`);
        }).catch(err => log(`[RECORDER] Upload error for local recording: ${err}`));
    };

    return localRecorder.stop().then(blob => {
        localRecorder = null;
        if (blob) return upload(blob);
        return Promise.resolve();
    });
}

/**
 * Завершает текущий звонок.
 * @param {boolean} isInitiatorOfHangup - True, если текущий пользователь нажал кнопку "повесить трубку".
 * @param {string} reason - Причина завершения.
 */
export function endCall(isInitiatorOfHangup, reason) {
    if (state.getState().isEndingCall) return;
    state.setIsEndingCall(true);
    hangupBtn.disabled = true;
    log(`[CALL] Ending call. Initiator of hangup: ${isInitiatorOfHangup}, Reason: ${reason}`);
    
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
    
    uploadRecordings().finally(() => {
        state.resetCallState();
        hangupBtn.disabled = false;
    });
}

async function initializeLocalMedia(callType) {
    if (state.getState().isSpectator) {
        log("[MEDIA] Spectator mode, skipping media initialization.");
        return false;
    }
    log(`[MEDIA] Requesting media for call type: ${callType}`);
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    let isVideoCall = callType === 'video';
    const isIOSAudioCall = isIOS() && callType === 'audio';
    
    if (isIOSAudioCall) {
        log("[MEDIA_IOS] Audio call on iOS detected. Requesting video to force speakerphone.");
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
            log("[MEDIA_IOS] Video track obtained for audio call. Disabling it now.");
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

export function toggleMute() {
    if (!media.getMediaAccessStatus().hasMicrophoneAccess) return;
    const newMuteState = !state.getState().isMuted;
    state.setIsMuted(newMuteState);
    webrtc.toggleMute(newMuteState, media.getLocalStream());
    document.getElementById('mute-btn').classList.toggle('active', newMuteState);
    log(`[CONTROLS] Mic ${newMuteState ? 'muted' : 'unmuted'}.`);
}

export function toggleSpeaker() {
    const newSpeakerMuteState = media.toggleRemoteSpeakerMute();
    state.setIsSpeakerMuted(newSpeakerMuteState);
    document.getElementById('speaker-btn').classList.toggle('active', newSpeakerMuteState);
    log(`[CONTROLS] Remote audio (speaker) ${newSpeakerMuteState ? 'muted' : 'unmuted'}.`);
}

export function toggleVideo() {
    if (!media.getMediaAccessStatus().hasCameraAccess) return;
    const newVideoState = !state.getState().isVideoEnabled;
    state.setIsVideoEnabled(newVideoState);
    webrtc.toggleVideo(newVideoState, media.getLocalStream());
    document.getElementById('video-btn').classList.toggle('active', !newVideoState);
    localVideoContainer.style.display = newVideoState ? 'flex' : 'none';
    log(`[CONTROLS] Video ${newVideoState ? 'enabled' : 'disabled'}.`);
}

export async function switchInputDevice(kind, deviceId) {
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

export async function switchAudioOutput(deviceId) {
    if (typeof remoteVideo.setSinkId !== 'function') {
        log('[SINK] setSinkId() is not supported by this browser.');
        alert('Ваш браузер не поддерживает переключение динамиков.');
        return;
    }
    try {
        await remoteVideo.setSinkId(deviceId);
        await document.getElementById('remoteAudio').setSinkId(deviceId);
        state.setSelectedAudioOutId(deviceId);
        log(`[SINK] Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        log(`[SINK] Error switching audio output: ${error}`);
        alert(`Не удалось переключить динамик: ${error.message}`);
    }
}

export async function updateRoomLifetime() {
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
        log(`[LIFETIME] Error fetching lifetime: ${error.message}`);
        uiManager.updateLifetimeDisplay(-1);
        clearInterval(state.getState().lifetimeTimerInterval);
    }
}

export async function closeSession() {
    log("[SESSION] User clicked close session button.");
    setGracefulDisconnect(true);
    try {
        await fetch(`/room/close/${state.getState().roomId}`, { method: 'POST' });
    } catch (error) {
        log(`[SESSION] Error sending close request: ${error}`);
        alert("Не удалось закрыть сессию. Попробуйте обновить страницу.");
    }
}

/**
 * Инициализирует все подсистемы звонка.
 */
export function init() {
    media.init(log);
    monitor.init({
        log: log,
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
        log: log,
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
                if (localStream && localStream.getAudioTracks().length > 0) {
                    const audioTrackForRecording = localStream.getAudioTracks()[0].clone();
                    const streamForRecording = new MediaStream([audioTrackForRecording]);
                    const recorderOptions = { audioBitsPerSecond: 16000 };
                    localRecorder = new CallRecorder(streamForRecording, log, recorderOptions);
                    localRecorder.start();
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
}