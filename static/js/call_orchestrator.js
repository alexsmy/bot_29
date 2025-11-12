import * as stateManager from './call_state.js';
import * as uiManager from './call_ui_manager.js';
import * as media from './call_media.js';
import * as webrtc from './call_webrtc.js';
import * as monitor from './call_connection_monitor.js';
import { sendMessage, initializeWebSocket, setGracefulDisconnect } from './call_websocket.js';
import {
    popupActions, acceptBtn, declineBtn, hangupBtn, speakerBtn, muteBtn, videoBtn,
    screenShareBtn, closeSessionBtn, instructionsBtn, deviceSettingsBtn
} from './call_ui_elements.js';

let log;

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function handleUserList(users) {
    const { currentUser } = stateManager.getState();
    const otherUsers = users.filter(u => u.id !== currentUser.id);

    if (otherUsers.length === 0) {
        stateManager.setState({ targetUser: {} });
        uiManager.showPreCallPopup('waiting');
    } else {
        const newTargetUser = otherUsers[0];
        stateManager.setState({ targetUser: newTargetUser });
        if (newTargetUser.status === 'busy') {
            uiManager.showPreCallPopup('initiating');
        } else {
            uiManager.showPreCallPopup('actions');
        }
    }
}

async function initiateCall(userToCall, callType) {
    log(`[CALL] Initiating call to user ${userToCall.id}, type: ${callType}`);
    stateManager.setState({ isCallInitiator: true, currentCallType: callType });

    if (callType === 'video') {
        uiManager.getRemoteVideoElement().play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(callType);
    if (!hasMedia) log("[CALL] Proceeding with call without local media.");

    const { roomId, currentUser } = stateManager.getState();
    monitor.connectionLogger.reset(roomId, currentUser.id, true);
    const probeResults = await monitor.probeIceServers();
    monitor.connectionLogger.setProbeResults(probeResults);

    sendMessage({ type: 'call_user', data: { target_id: userToCall.id, call_type: callType } });

    uiManager.showScreen('call');
    const mediaStatus = media.getMediaAccessStatus();
    uiManager.updateCallUI(callType, userToCall, mediaStatus, isMobileDevice());
    uiManager.showCallingOverlay(true, callType);
    uiManager.playAudio('ringOut');
}

function handleIncomingCall(data) {
    log(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    stateManager.setState({
        isCallInitiator: false,
        targetUser: data.from_user,
        currentCallType: data.call_type
    });

    uiManager.showIncomingCall(data.from_user?.first_name || 'Собеседник', data.call_type);
    uiManager.playAudio('ringIn');
}

async function acceptCall() {
    log("[CALL] 'Accept' button pressed.");
    uiManager.stopAudio('ringIn');
    uiManager.showModal('incoming-call', false);

    const { currentCallType, targetUser } = stateManager.getState();

    if (currentCallType === 'video') {
        uiManager.getRemoteVideoElement().play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType);
    if (!hasMedia) log("[CALL] No local media available, accepting as receive-only.");

    log("[CALL] Starting WebRTC connection.");
    
    const { roomId, currentUser } = stateManager.getState();
    monitor.connectionLogger.reset(roomId, currentUser.id, false);
    
    const localStream = media.getLocalStream();
    const { rtcConfig } = stateManager.getState();
    await webrtc.startPeerConnection(targetUser.id, false, currentCallType, localStream, rtcConfig, monitor.connectionLogger);
    sendMessage({ type: 'call_accepted', data: { target_id: targetUser.id } });
}

function declineCall() {
    log("[CALL] Declining call.");
    uiManager.stopAudio('ringIn');
    uiManager.showModal('incoming-call', false);
    const { targetUser } = stateManager.getState();
    sendMessage({ type: 'call_declined', data: { target_id: targetUser.id } });
    stateManager.setState({ targetUser: {} });
}

async function endCall(isInitiator, reason) {
    const { isEndingCall, targetUser } = stateManager.getState();
    if (isEndingCall) return;
    stateManager.setState({ isEndingCall: true });

    log(`[CALL] Ending call. Initiator: ${isInitiator}, Reason: ${reason}`);
    setGracefulDisconnect(true);

    if (isInitiator && targetUser.id) {
        sendMessage({ type: 'hangup', data: { target_id: targetUser.id } });
    }

    if (isInitiator && !monitor.connectionLogger.isDataSent) {
        monitor.connectionLogger.sendProbeLog();
    }

    monitor.stopConnectionMonitoring();
    webrtc.endPeerConnection();
    media.stopAllStreams();
    uiManager.cleanupAfterCall();
    stateManager.resetStateForNewCall();
}

async function initializeLocalMedia(callType) {
    const { isSpectator, selectedAudioInId, selectedVideoId } = stateManager.getState();
    if (isSpectator) {
        log("[MEDIA] Spectator mode, skipping media initialization.");
        return false;
    }
    log(`[MEDIA] Requesting media for call type: ${callType}`);
    
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    let isVideoCall = callType === 'video';
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isIOSAudioCall = isIOS && callType === 'audio';
    if (isIOSAudioCall) {
        log("[MEDIA_IOS] Audio call on iOS detected. Requesting video to force speakerphone.");
        isVideoCall = true;
    }

    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
        video: isVideoCall && hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
    };

    const result = await media.getStreamForCall(constraints, uiManager.getLocalVideoElement(), uiManager.getLocalAudioElement());
    
    if (result.stream) {
        if (isIOSAudioCall && result.stream.getVideoTracks().length > 0) {
            log("[MEDIA_IOS] Video track obtained for audio call. Disabling it now.");
            result.stream.getVideoTracks()[0].enabled = false;
            uiManager.setLocalVideoVisibility(false);
            stateManager.setState({ isVideoEnabled: false });
        } else {
            uiManager.setLocalVideoVisibility(result.isVideo);
            stateManager.setState({ isVideoEnabled: result.isVideo });
        }
        return true;
    }
    return false;
}

function bindUIEvents() {
    popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        const { targetUser } = stateManager.getState();
        if (button && targetUser.id) {
            initiateCall(targetUser, button.dataset.callType);
        }
    });

    acceptBtn.addEventListener('click', acceptCall);
    declineBtn.addEventListener('click', declineCall);
    hangupBtn.addEventListener('click', () => endCall(true, 'cancelled_by_user'));
    closeSessionBtn.addEventListener('click', async () => {
        log("[SESSION] User clicked close session button.");
        setGracefulDisconnect(true);
        const { roomId } = stateManager.getState();
        try {
            await fetch(`/room/close/${roomId}`, { method: 'POST' });
        } catch (error) {
            log(`[SESSION] Error sending close request: ${error}`);
        }
    });

    instructionsBtn.addEventListener('click', () => uiManager.showModal('instructions', true));
    deviceSettingsBtn.addEventListener('click', uiManager.openDeviceSettings);

    muteBtn.addEventListener('click', () => {
        if (!media.getMediaAccessStatus().hasMicrophoneAccess) return;
        const { isMuted } = stateManager.getState();
        const newMuteState = !isMuted;
        webrtc.toggleMute(newMuteState, media.getLocalStream());
        stateManager.setState({ isMuted: newMuteState });
        uiManager.updateMuteButton(newMuteState);
        log(`[CONTROLS] Mic ${newMuteState ? 'muted' : 'unmuted'}.`);
    });

    speakerBtn.addEventListener('click', () => {
        const newSpeakerMuteState = media.toggleRemoteSpeakerMute();
        stateManager.setState({ isSpeakerMuted: newSpeakerMuteState });
        uiManager.updateSpeakerButton(newSpeakerMuteState);
        log(`[CONTROLS] Remote audio (speaker) ${newSpeakerMuteState ? 'muted' : 'unmuted'}.`);
    });

    videoBtn.addEventListener('click', () => {
        if (!media.getMediaAccessStatus().hasCameraAccess) return;
        const { isVideoEnabled } = stateManager.getState();
        const newVideoState = !isVideoEnabled;
        webrtc.toggleVideo(newVideoState, media.getLocalStream());
        stateManager.setState({ isVideoEnabled: newVideoState });
        uiManager.updateVideoButton(newVideoState);
        uiManager.setLocalVideoVisibility(newVideoState);
        log(`[CONTROLS] Video ${newVideoState ? 'enabled' : 'disabled'}.`);
    });

    screenShareBtn.addEventListener('click', () => {
        const { isVideoEnabled, currentCallType } = stateManager.getState();
        webrtc.toggleScreenShare(media.getLocalStream(), (isSharing) => {
            uiManager.updateScreenShareUI(isSharing, isVideoEnabled, currentCallType);
        });
    });
}

export function initialize(logger) {
    log = logger;

    const wsHandlers = {
        onIdentity: (data) => {
            stateManager.setState({ currentUser: { id: data.id } });
            log(`[WS] Identity assigned by server: ${data.id}`);
        },
        onUserList: handleUserList,
        onIncomingCall: handleIncomingCall,
        onCallAccepted: () => {
            uiManager.stopAudio('ringOut');
            const { targetUser, currentCallType, rtcConfig } = stateManager.getState();
            const localStream = media.getLocalStream();
            webrtc.startPeerConnection(targetUser.id, true, currentCallType, localStream, rtcConfig, monitor.connectionLogger);
        },
        onOffer: (data) => {
            const localStream = media.getLocalStream();
            const { rtcConfig } = stateManager.getState();
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
            uiManager.redirectToInvalidLink();
        },
        onFatalError: uiManager.redirectToInvalidLink
    };

    const { roomId } = stateManager.getState();
    initializeWebSocket(roomId, wsHandlers, log);
    bindUIEvents();
}