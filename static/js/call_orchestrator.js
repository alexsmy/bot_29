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
    instructionsBtn, acceptBtn, declineBtn, hangupBtn, speakerBtn,
    muteBtn, videoBtn, screenShareBtn, localVideo, remoteVideo, localVideoContainer,
    toggleLocalViewBtn, toggleRemoteViewBtn, connectionStatus, deviceSettingsBtn,
    cameraSelectCall, micSelectCall, speakerSelectCall
} from './call_ui_elements.js';
import { log } from './call_logger.js';

let localRecorder = null;

const SCREENSHOT_SCALE = 1.0; 
const SCREENSHOT_QUALITY = 0.75; 
const RECORDING_TIMESLICE_MS = 60000;

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
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
        log('MEDIA_DEVICES', 'No media devices available or access denied to all.');
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
    log('CALL_SESSION', `Proceeding to call screen. Spectator mode: ${asSpectator}`);
    media.stopPreviewStream();
    uiManager.showScreen('pre-call');

    const currentRole = state.getState().role;
    if (currentRole === 'roll_in') {
        uiManager.showPopup('receiver-waiting');
    } else {
        uiManager.showPopup('waiting');
    }

    const wsHandlers = {
        onIdentity: (data) => {
            state.setCurrentUser({ id: data.id });
            state.setRoomType(data.room_type || 'private');
            state.setIsAutoAnswerDevice(data.is_first_in_special_room || false);
            
            log('APP_LIFECYCLE', `Identity assigned: ${state.getState().currentUser.id}, RoomType: ${state.getState().roomType}, Role: ${currentRole}`);

            if (state.getState().roomType === 'special') {
                uiManager.showSpecialModeLabel(true);
            }
            if (state.getState().isAutoAnswerDevice) {
                log('APP_LIFECYCLE', 'This device is set to auto-answer mode.');
            }
        },
        onUserList: handleUserList,
        onIncomingCall: handleIncomingCall,
        onCallAccepted: () => {
            uiManager.stopRingOutSound();
            const localStream = media.getLocalStream();
            webrtc.startPeerConnection(state.getState().targetUser.id, true, state.getState().currentCallType, localStream, state.getState().rtcConfig);
        },
        onOffer: (data) => {
            const localStream = media.getLocalStream();
            webrtc.handleOffer(data, localStream, state.getState().rtcConfig);
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
    const currentRole = state.getState().role;

    if (otherUsers.length === 0) {
        state.setTargetUser({});
        if (currentRole === 'roll_in') {
            uiManager.showPopup('receiver-waiting');
        } else {
            uiManager.showPopup('waiting');
        }
    } else {
        state.setTargetUser(otherUsers[0]);
        if (state.getState().targetUser.status === 'busy') {
            uiManager.showPopup('initiating');
        } else {
            if (currentRole === 'roll_in') {
                uiManager.showPopup('receiver-waiting');
            } else {
                uiManager.showPopup('actions');
            }
        }
    }
}

async function initiateCall(userToCall, callType) {
    if (state.getState().isEndingCall) {
        log('CALL_FLOW', "Attempted to initiate call while previous one is ending. Aborted.");
        return;
    }
    log('CALL_FLOW', `Initiating call to user ${userToCall.id}, type: ${callType}`);
    state.setIsCallInitiator(true);
    state.setCurrentCallType(callType);
    if (callType === 'video') {
        remoteVideo.play().catch(() => {});
    }
    const hasMedia = await initializeLocalMedia(callType);
    if (!hasMedia) log('MEDIA_DEVICES', "Proceeding with call without local media.");
    state.setTargetUser(userToCall);
    sendMessage({ type: 'call_user', data: { target_id: state.getState().targetUser.id, call_type: callType } });
    uiManager.showScreen('call');
    const mediaStatus = media.getMediaAccessStatus();
    uiManager.updateCallUI(callType, state.getState().targetUser, mediaStatus, isMobileDevice());
    uiManager.showCallingOverlay(true, callType);
    uiManager.playRingOutSound();
}

function handleIncomingCall(data) {
    const s = state.getState();
    if (s.role === 'roll_in' || s.isAutoAnswerDevice) {
        log('CALL_FLOW', 'Auto-answering incoming call due to role or device setting.');
        state.setIsCallInitiator(false);
        state.setTargetUser(data.from_user);
        state.setCurrentCallType(data.call_type);
        acceptCall();
        return;
    }

    log('CALL_FLOW', `Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    state.setIsCallInitiator(false);
    state.setTargetUser(data.from_user);
    state.setCurrentCallType(data.call_type);
    uiManager.showIncomingCall(data.from_user?.first_name || 'Собеседник', data.call_type);
}

async function acceptCall() {
    log('CALL_FLOW', "'Accept' button pressed.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    if (state.getState().currentCallType === 'video') {
        remoteVideo.play().catch(() => {});
    }
    const hasMedia = await initializeLocalMedia(state.getState().currentCallType);
    if (!hasMedia) log('MEDIA_DEVICES', "No local media available, accepting as receive-only.");
    log('WEBRTC_LIFECYCLE', "Starting WebRTC connection.");
    const localStream = media.getLocalStream();
    await webrtc.startPeerConnection(state.getState().targetUser.id, false, state.getState().currentCallType, localStream, state.getState().rtcConfig);
    sendMessage({ type: 'call_accepted', data: { target_id: state.getState().targetUser.id } });
}

function declineCall() {
    log('CALL_FLOW', "Declining call.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    sendMessage({ type: 'call_declined', data: { target_id: state.getState().targetUser.id } });
    state.setTargetUser({});
}

function stopAndFinalizeRecording() {
    if (!state.getState().isRecordingEnabled || !localRecorder) {
        return Promise.resolve();
    }
    log('RECORDER', 'Stopping local recording...');
    return localRecorder.stop().then(() => {
        localRecorder = null;
    });
}

function uploadAudioChunk(blob) {
    if (!blob || blob.size === 0) {
        log('RECORDER', `Skipping empty audio chunk.`);
        return;
    }
    const s = state.getState();
    const formData = new FormData();
    formData.append('room_id', s.roomId);
    formData.append('user_id', s.currentUser.id);
    formData.append('chunk_index', s.localRecordingChunkIndex);
    formData.append('file', blob, `chunk_${s.localRecordingChunkIndex}.webm`);

    log('RECORDER', `Uploading chunk #${s.localRecordingChunkIndex}, size: ${Math.round(blob.size / 1024)} KB`);

    fetch('/api/record/upload', {
        method: 'POST',
        body: formData
    }).then(response => {
        if (response.ok) {
            log('RECORDER', `Chunk #${s.localRecordingChunkIndex} uploaded successfully.`);
            state.incrementLocalRecordingChunkIndex();
        } else {
            log('RECORDER', `FAILED to upload chunk #${s.localRecordingChunkIndex}.`);
        }
    }).catch(err => log('RECORDER', `Upload error for chunk #${s.localRecordingChunkIndex}: ${err}`));
}


function endCall(isInitiatorOfHangup, reason) {
    if (state.getState().isEndingCall) return;
    state.setIsEndingCall(true);
    hangupBtn.disabled = true;
    log('CALL_SESSION', `Ending call. Initiator of hangup: ${isInitiatorOfHangup}, Reason: ${reason}`);
    
    setGracefulDisconnect(true);
    if (isInitiatorOfHangup && state.getState().targetUser.id) {
        sendMessage({ type: 'hangup', data: { target_id: state.getState().targetUser.id } });
    }
    monitor.stopConnectionMonitoring();
    webrtc.endPeerConnection();
    
    stopAndFinalizeRecording().finally(() => {
        media.stopAllStreams();
        uiManager.stopAllSounds();
        uiManager.cleanupAfterCall(state.getState().callTimerInterval);
        state.setCallTimerInterval(null);
        
        state.resetCallState();
        hangupBtn.disabled = false;
    });
}

async function initializeLocalMedia(callType) {
    if (state.getState().isSpectator) {
        log('MEDIA_DEVICES', "Spectator mode, skipping media initialization.");
        return false;
    }
    log('MEDIA_DEVICES', `Requesting media for call type: ${callType}`);
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    let isVideoCall = callType === 'video';
    const isIOSAudioCall = isIOS() && callType === 'audio';
    if (isIOSAudioCall) {
        log('MEDIA_DEVICES', "Audio call on iOS detected. Requesting video to force speakerphone.");
        isVideoCall = true;
    }
    const s = state.getState();

    const audioConstraints = {
        deviceId: { exact: s.selectedAudioInId }
    };
    if (isIOS()) {
        audioConstraints.sampleRate = { ideal: 8000 };
        log('MEDIA_DEVICES', 'iOS detected. Requesting ideal audio sample rate of 8000Hz.');
    }

    const constraints = {
        audio: hasMicrophoneAccess ? audioConstraints : false,
        video: isVideoCall && hasCameraAccess ? { deviceId: { exact: s.selectedVideoId } } : false
    };

    const result = await media.getStreamForCall(constraints, localVideo, document.getElementById('localAudio'));
    if (result.stream) {
        if (isIOSAudioCall && result.stream.getVideoTracks().length > 0) {
            log('MEDIA_DEVICES', "Video track obtained for audio call. Disabling it now.");
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
    log('UI_INTERACTIONS', `Mic ${newMuteState ? 'muted' : 'unmuted'}.`);
}

function toggleSpeaker() {
    const newSpeakerMuteState = media.toggleRemoteSpeakerMute();
    state.setIsSpeakerMuted(newSpeakerMuteState);
    speakerBtn.classList.toggle('active', newSpeakerMuteState);
    log('UI_INTERACTIONS', `Remote audio (speaker) ${newSpeakerMuteState ? 'muted' : 'unmuted'}.`);
}

function toggleVideo() {
    if (!media.getMediaAccessStatus().hasCameraAccess) return;
    const newVideoState = !state.getState().isVideoEnabled;
    state.setIsVideoEnabled(newVideoState);
    webrtc.toggleVideo(newVideoState, media.getLocalStream());
    videoBtn.classList.toggle('active', !newVideoState);
    localVideoContainer.style.display = newVideoState ? 'flex' : 'none';
    log('UI_INTERACTIONS', `Video ${newVideoState ? 'enabled' : 'disabled'}.`);
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
        log('SINK_ID', 'setSinkId() is not supported by this browser.');
        alert('Ваш браузер не поддерживает переключение динамиков.');
        return;
    }
    try {
        await remoteVideo.setSinkId(deviceId);
        await document.getElementById('remoteAudio').setSinkId(deviceId);
        state.setSelectedAudioOutId(deviceId);
        log('SINK_ID', `Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        log('SINK_ID', `Error switching audio output: ${error}`);
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
        log('APP_LIFECYCLE', `Error fetching lifetime: ${error.message}`);
        uiManager.updateLifetimeDisplay(-1);
        clearInterval(state.getState().lifetimeTimerInterval);
    }
}

function redirectToInvalidLink() {
    setGracefulDisconnect(true);
    window.location.reload();
}

async function takeAndUploadScreenshot() {
    const s = state.getState();
    if (typeof html2canvas === 'undefined') {
        log('SCREENSHOT', 'html2canvas library is not loaded. Skipping screenshot.');
        return;
    }

    log('SCREENSHOT', 'Starting single-capture screenshot process...');

    const oncloneHandler = (clonedDoc) => {
        const handleVideoElement = (originalVideo, clonedVideo) => {
            if (!clonedVideo || originalVideo.videoWidth === 0 || originalVideo.videoHeight === 0) return;
            
            const canvas = clonedDoc.createElement('canvas');
            canvas.width = originalVideo.videoWidth;
            canvas.height = originalVideo.videoHeight;
            const ctx = canvas.getContext('2d');

            if (originalVideo.id === 'localVideo') {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            
            ctx.drawImage(originalVideo, 0, 0, canvas.width, canvas.height);
            canvas.style.cssText = getComputedStyle(originalVideo).cssText;
            clonedVideo.parentNode.replaceChild(canvas, clonedVideo);
        };

        const clonedRemoteVideo = clonedDoc.getElementById('remoteVideo');
        const clonedLocalVideo = clonedDoc.getElementById('localVideo');
        
        if (clonedRemoteVideo) handleVideoElement(remoteVideo, clonedRemoteVideo);
        if (clonedLocalVideo) handleVideoElement(localVideo, clonedLocalVideo);
    };

    try {
        const canvas = await html2canvas(document.getElementById('call-screen'), { 
            useCORS: true,
            onclone: oncloneHandler,
            scale: SCREENSHOT_SCALE
        });
        
        canvas.toBlob(blob => {
            if (!blob) {
                log('SCREENSHOT', 'Failed to create blob from canvas.');
                return;
            }
            const formData = new FormData();
            formData.append('room_id', s.roomId);
            formData.append('user_id', s.currentUser.id);
            formData.append('file', blob, 'screenshot.jpg');

            fetch('/api/record/screenshot', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'ok') {
                    log('SCREENSHOT', `Screenshot uploaded successfully. Size: ${Math.round(blob.size / 1024)} KB`);
                } else {
                    log('SCREENSHOT', `Server failed to process screenshot: ${data.detail}`);
                }
            })
            .catch(err => log('SCREENSHOT', `Upload error: ${err}`));
        }, 'image/jpeg', SCREENSHOT_QUALITY);
    } catch (error) {
        log('SCREENSHOT', `Error during html2canvas execution: ${error}`);
    }
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
        if (state.getState().role !== 'roll_in') {
            endCall(true, 'cancelled_by_user');
        }
    });
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

export function initialize(roomId, rtcConfig, iceServerDetails, isRecordingEnabled, role) {
    log('APP_LIFECYCLE', `Initializing for room: ${roomId}, Role: ${role}`);
    state.setRoomId(roomId);
    state.setRtcConfig(rtcConfig);
    state.setIceServerDetails(iceServerDetails);
    state.setIsRecordingEnabled(isRecordingEnabled);
    state.setRole(role);

    media.init(log);
    monitor.init({
        log: log,
        getPeerConnection: webrtc.getPeerConnection,
        updateConnectionIcon: uiManager.updateConnectionIcon,
        updateConnectionQualityIcon: uiManager.updateConnectionQualityIcon,
        showConnectionToast: uiManager.showConnectionToast,
        getIceServerDetails: () => state.getState().iceServerDetails,
        onConnectionEstablished: (type) => {
            sendMessage({ type: 'connection_established', data: { type: type } });
        }
    });
    webrtc.init({
        log: log,
        onCallConnected: () => {
            if (state.getState().isCallConnected) {
                log('CALL_FLOW', "onCallConnected triggered again, but call is already active. Ignoring.");
                return;
            }
            state.setIsCallConnected(true);

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
                    
                    const recorderOptions = { 
                        audioBitsPerSecond: 8000,
                        timeslice: RECORDING_TIMESLICE_MS 
                    };
                    
                    localRecorder = new CallRecorder(streamForRecording, log, uploadAudioChunk, recorderOptions);
                    localRecorder.start();
                }
            }

            setTimeout(takeAndUploadScreenshot, 7000);
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