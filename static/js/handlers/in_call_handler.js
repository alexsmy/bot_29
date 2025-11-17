import * as state from '../call_state.js';
import * as uiManager from '../call_ui_manager.js';
import * as media from '../call_media.js';
import * as webrtc from '../call_webrtc.js';
import * as monitor from '../call_connection_monitor.js';
import { CallRecorder } from '../call_recorder.js';
import { sendMessage, setGracefulDisconnect } from '../call_websocket.js';
import { log } from '../call_logger.js';
import {
    hangupBtn, speakerBtn, muteBtn, videoBtn, screenShareBtn,
    localVideo, remoteVideo, localVideoContainer
} from '../call_ui_elements.js';

let localRecorder = null;

const SCREENSHOT_SCALE = 1.0;
const SCREENSHOT_QUALITY = 0.75;
const RECORDING_TIMESLICE_MS = 60000;

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

export function onCallConnected() {
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
}

export async function acceptCall() {
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

export function declineCall() {
    log('CALL_FLOW', "Declining call.");
    uiManager.stopIncomingRing();
    uiManager.showModal('incoming-call', false);
    sendMessage({ type: 'call_declined', data: { target_id: state.getState().targetUser.id } });
    state.setTargetUser({});
}

export function endCall(isInitiatorOfHangup, reason) {
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

export async function startActiveCall(callType, targetUser) {
    if (state.getState().isEndingCall) {
        log('CALL_FLOW', "Attempted to initiate call while previous one is ending. Aborted.");
        return;
    }
    log('CALL_FLOW', `Initiating call to user ${targetUser.id}, type: ${callType}`);
    state.setIsCallInitiator(true);
    state.setCurrentCallType(callType);
    if (callType === 'video') {
        remoteVideo.play().catch(() => {});
    }
    const hasMedia = await initializeLocalMedia(callType);
    if (!hasMedia) log('MEDIA_DEVICES', "Proceeding with call without local media.");
    state.setTargetUser(targetUser);
    sendMessage({ type: 'call_user', data: { target_id: state.getState().targetUser.id, call_type: callType } });
    uiManager.showScreen('call');
    const mediaStatus = media.getMediaAccessStatus();
    uiManager.updateCallUI(callType, state.getState().targetUser, mediaStatus, isMobileDevice());
    uiManager.showCallingOverlay(true, callType);
    uiManager.playRingOutSound();
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

export function init() {
    speakerBtn.addEventListener('click', toggleSpeaker);
    muteBtn.addEventListener('click', toggleMute);
    videoBtn.addEventListener('click', toggleVideo);
    screenShareBtn.addEventListener('click', () => webrtc.toggleScreenShare(media.getLocalStream(), (isSharing) => uiManager.updateScreenShareUI(isSharing, state.getState().isVideoEnabled, state.getState().currentCallType)));
    hangupBtn.addEventListener('click', () => {
        if (state.getState().role !== 'roll_in') {
            endCall(true, 'cancelled_by_user');
        }
    });
}