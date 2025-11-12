import { sendMessage } from './call_websocket.js';
import { remoteVideo, remoteAudio, localVideo } from './call_ui_elements.js';

const PREVENT_P2P_DOWNGRADE = true;

let peerConnection;
let remoteStream;
let dataChannel;
let iceCandidateQueue = [];
let isScreenSharing = false;
let screenStream = null;
let originalVideoTrack = null;
let iceRestartTimeoutId = null;

let callbacks = {
    log: () => {},
    onCallConnected: () => {},
    onCallEndedByPeer: () => {},
    onRemoteTrack: () => {},
    onRemoteMuteStatus: () => {},
    updateConnectionIcon: () => {},
    getCurrentConnectionType: () => 'unknown',
    setCurrentConnectionType: () => {},
    setCurrentConnectionDetails: () => {},
};

export function init(cb) {
    callbacks = { ...callbacks, ...cb };
}

export function getRemoteStream() {
    return remoteStream;
}

function setupDataChannelEvents(channel) {
    channel.onopen = () => callbacks.log('[DC] DataChannel is open.');
    channel.onclose = () => callbacks.log('[DC] DataChannel is closed.');
    channel.onerror = (error) => callbacks.log(`[DC] DataChannel error: ${error}`);
    channel.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            callbacks.log(`[DC] Received message: ${message.type}`);
            if (message.type === 'hangup') {
                callbacks.onCallEndedByPeer('ended_by_peer_dc');
            } else if (message.type === 'mute_status') {
                callbacks.onRemoteMuteStatus(message.muted);
            }
        } catch (e) {
            callbacks.log(`[DC] Received non-JSON message: ${event.data}`);
        }
    };
}

async function initiateIceRestart() {
    if (!peerConnection) return;
    callbacks.log('[WEBRTC] Creating new offer with iceRestart: true');
    try {
        const offer = await peerConnection.createOffer({ iceRestart: true });
        await peerConnection.setLocalDescription(offer);
        sendMessage({ type: 'offer', data: { target_id: callbacks.getTargetUser().id, offer: offer } });
    } catch (error) {
        callbacks.log(`[WEBRTC] ICE Restart failed: ${error}`);
        callbacks.onCallEndedByPeer('ice_restart_failed');
    }
}

export async function createPeerConnection(rtcConfig, localStream, selectedAudioOutId, connectionLogger) {
    callbacks.log("[WEBRTC] Creating RTCPeerConnection.");
    if (!rtcConfig) {
        callbacks.log("[CRITICAL] rtcConfig is not available.");
        alert("Ошибка конфигурации сети. Пожалуйста, обновите страницу.");
        return;
    }

    if (peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection(rtcConfig);
    remoteStream = new MediaStream();

    remoteVideo.muted = true;
    remoteAudio.muted = true;

    remoteVideo.srcObject = remoteStream;
    remoteAudio.srcObject = remoteStream;

    if (selectedAudioOutId && typeof remoteVideo.setSinkId === 'function') {
        callbacks.log(`[SINK] Applying initial sinkId: ${selectedAudioOutId}`);
        remoteVideo.setSinkId(selectedAudioOutId).catch(e => callbacks.log(`[SINK] Error setting sinkId for video: ${e}`));
        remoteAudio.setSinkId(selectedAudioOutId).catch(e => callbacks.log(`[SINK] Error setting sinkId for audio: ${e}`));
    }

    peerConnection.ondatachannel = (event) => {
        callbacks.log('[DC] Received remote DataChannel.');
        dataChannel = event.channel;
        setupDataChannelEvents(dataChannel);
    };

    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        callbacks.log(`[WEBRTC] ICE State: ${state}`);
        
        if (state === 'connected') {
            connectionLogger.analyzeAndSend();
            if (iceRestartTimeoutId) {
                clearTimeout(iceRestartTimeoutId);
                iceRestartTimeoutId = null;
                callbacks.log('[WEBRTC] Connection recovered before ICE Restart was initiated.');
            }
        } else if (state === 'disconnected') {
            callbacks.log('[WEBRTC] Connection is disconnected. Scheduling ICE Restart check.');
            if (iceRestartTimeoutId) clearTimeout(iceRestartTimeoutId);
            iceRestartTimeoutId = setTimeout(() => {
                if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
                    callbacks.log('[WEBRTC] Connection did not recover. Initiating ICE Restart.');
                    initiateIceRestart();
                }
            }, 5000);
        } else if (state === 'failed') {
            callbacks.log(`[WEBRTC] P2P connection failed. Ending call.`);
            callbacks.onCallEndedByPeer('p2p_failed'); 
        }
    };

    peerConnection.onsignalingstatechange = () => callbacks.log(`[WEBRTC] Signaling State: ${peerConnection.signalingState}`);
    
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
           const isRelayCandidate = event.candidate.candidate.includes(" typ relay ");
            
            if (PREVENT_P2P_DOWNGRADE && callbacks.getCurrentConnectionType() === 'p2p' && isRelayCandidate) {
                callbacks.log(`[WEBRTC_POLICY] Blocking TURN candidate to prevent downgrade from P2P.`);
                return; 
            }

            sendMessage({ type: 'candidate', data: { target_id: callbacks.getTargetUser().id, candidate: event.candidate } });
        }
    };

    peerConnection.ontrack = event => {
        callbacks.log(`[WEBRTC] Received remote track: ${event.track.kind}`);
        remoteStream.addTrack(event.track);
        callbacks.onRemoteTrack(remoteStream);
    };

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        callbacks.log("[WEBRTC] Local tracks added to PeerConnection.");
    } else {
        callbacks.log("[WEBRTC] No local stream available to add tracks.");
    }
}

export async function startPeerConnection(targetId, isCaller, callType, localStream, rtcConfig, connectionLogger) {
    callbacks.log(`[WEBRTC] Starting PeerConnection. Is caller: ${isCaller}`);
    await createPeerConnection(rtcConfig, localStream, callbacks.getSelectedAudioOutId(), connectionLogger);

    if (isCaller) {
        callbacks.log('[DC] Creating DataChannel.');
        dataChannel = peerConnection.createDataChannel('control');
        setupDataChannelEvents(dataChannel);

        const offerOptions = {
            offerToReceiveAudio: true, 
            offerToReceiveVideo: callType === 'video' 
        };
        callbacks.log(`[WEBRTC] Creating Offer with options: ${JSON.stringify(offerOptions)}`);
        const offer = await peerConnection.createOffer(offerOptions);

        await peerConnection.setLocalDescription(offer);
        sendMessage({ type: 'offer', data: { target_id: targetId, offer: offer } });
    }
}

async function processIceCandidateQueue() {
    while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        try {
            await peerConnection.addIceCandidate(candidate);
            callbacks.log("[WEBRTC] Added a queued ICE candidate.");
        } catch (e) {
            callbacks.log(`[WEBRTC] ERROR adding queued ICE candidate: ${e}`);
        }
    }
}

export async function handleOffer(data, localStream, rtcConfig, connectionLogger) {
    callbacks.log("[WEBRTC] Received Offer, creating Answer.");
    if (!peerConnection) {
        await startPeerConnection(data.from, false, data.call_type, localStream, rtcConfig, connectionLogger);
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    sendMessage({ type: 'answer', data: { target_id: data.from, answer: answer } });
    
    callbacks.onCallConnected();
    processIceCandidateQueue();
}

export async function handleAnswer(data) {
    callbacks.log("[WEBRTC] Received Answer.");
    if (peerConnection && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        callbacks.onCallConnected();
        processIceCandidateQueue();
    }
}

export async function handleCandidate(data) {
    if (data.candidate) {
        const candidate = new RTCIceCandidate(data.candidate);
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(candidate);
        } else {
            iceCandidateQueue.push(candidate);
            callbacks.log("[WEBRTC] Queued an ICE candidate.");
        }
    }
}

export function endPeerConnection() {
    if (iceRestartTimeoutId) clearTimeout(iceRestartTimeoutId);
    iceRestartTimeoutId = null;

    if (isScreenSharing) {
        if (screenStream) screenStream.getTracks().forEach(track => track.stop());
        isScreenSharing = false;
        screenStream = null;
        originalVideoTrack = null;
    }

    if (dataChannel) {
        dataChannel.onmessage = null;
        dataChannel.onopen = null;
        dataChannel.onclose = null;
        dataChannel.close();
        dataChannel = null;
    }

    if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.onsignalingstatechange = null;
        peerConnection.ondatachannel = null;
        peerConnection.close();
        peerConnection = null;
    }

    remoteAudio.srcObject = null;
    remoteVideo.srcObject = null;
    
    iceCandidateQueue = [];
    callbacks.log('[WEBRTC] Peer connection resources cleaned up.');
}

export function toggleMute(isMuted, localStream) {
    if (localStream) localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'mute_status', muted: isMuted }));
    }
}

export function toggleVideo(isVideoEnabled, localStream) {
    if (isScreenSharing) return;
    if (localStream) localStream.getVideoTracks().forEach(track => track.enabled = isVideoEnabled);
}

export async function toggleScreenShare(localStream, onStateChange) {
    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            originalVideoTrack = localStream?.getVideoTracks()[0] || null;
            const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) await sender.replaceTrack(screenTrack);
            screenTrack.onended = () => { if (isScreenSharing) toggleScreenShare(localStream, onStateChange); };
            isScreenSharing = true;
            onStateChange(true);
            callbacks.log("[CONTROLS] Screen sharing started.");
        } catch (error) {
            callbacks.log(`[CONTROLS] Could not start screen sharing: ${error.message}`);
        }
    } else {
        if (screenStream) screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
            await sender.replaceTrack(originalVideoTrack);
            if (originalVideoTrack) {
                originalVideoTrack.enabled = callbacks.isVideoEnabled();
            }
        }
        isScreenSharing = false;
        onStateChange(false);
        callbacks.log("[CONTROLS] Screen sharing stopped.");
    }
}

export async function switchInputDevice(kind, deviceId, localStream) {
    if (!localStream || !peerConnection) return null;
    callbacks.log(`[CONTROLS] Switching ${kind} input to deviceId: ${deviceId}`);

    try {
        const currentTrack = kind === 'video' ? localStream.getVideoTracks()[0] : localStream.getAudioTracks()[0];
        if (currentTrack) {
            currentTrack.stop();
        }

        const newStream = await navigator.mediaDevices.getUserMedia({ [kind]: { deviceId: { exact: deviceId } } });
        const newTrack = newStream.getTracks()[0];

        const sender = peerConnection.getSenders().find(s => s.track?.kind === kind);
        if (sender) {
            await sender.replaceTrack(newTrack);
        }

        localStream.removeTrack(currentTrack);
        localStream.addTrack(newTrack);

        if (kind === 'video') {
            originalVideoTrack = newTrack;
            localVideo.srcObject = localStream;
            await localVideo.play();
        }
        return newTrack;
    } catch (error) {
        callbacks.log(`[CONTROLS] Error switching ${kind} device: ${error}`);
        return null;
    }
}

export function getPeerConnection() {
    return peerConnection;
}