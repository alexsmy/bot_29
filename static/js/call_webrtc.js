// Модуль для управления WebRTC соединением

let peerConnection;
let dataChannel;
let iceCandidateQueue = [];
let remoteStream;

// Конфигурация и колбэки, которые предоставляет основной модуль
let config = {
    rtcConfig: null,
    sendMessageCallback: () => {},
    onTrackCallback: () => {},
    onDataChannelMessageCallback: () => {},
    onConnectionStateChangeCallback: () => {},
    logCallback: console.log,
};

function setupDataChannelEvents(channel) {
    channel.onopen = () => config.logCallback('[DC] DataChannel is open.');
    channel.onclose = () => config.logCallback('[DC] DataChannel is closed.');
    channel.onerror = (error) => config.logCallback(`[DC] DataChannel error: ${error}`);
    channel.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            config.logCallback(`[DC] Received message: ${message.type}`);
            config.onDataChannelMessageCallback(message);
        } catch (e) {
            config.logCallback(`[DC] Received non-JSON message: ${event.data}`);
        }
    };
}

async function processIceCandidateQueue() {
    while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        try {
            if (peerConnection && peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(candidate);
                config.logCallback("[WEBRTC] Added a queued ICE candidate.");
            } else {
                iceCandidateQueue.unshift(candidate);
                break;
            }
        } catch (e) {
            config.logCallback(`[WEBRTC] ERROR adding queued ICE candidate: ${e}`);
        }
    }
}

export function initWebRTC(initialConfig) {
    config = { ...config, ...initialConfig };
    remoteStream = new MediaStream();
}

async function createPeerConnectionInternal(localStream, onIceCandidateCallback) {
    config.logCallback("[WEBRTC] Creating RTCPeerConnection.");
    if (!config.rtcConfig) {
        config.logCallback("[CRITICAL] rtcConfig is not available.");
        alert("Ошибка конфигурации сети. Пожалуйста, обновите страницу.");
        return null;
    }

    if (peerConnection) {
        peerConnection.close();
    }
    peerConnection = new RTCPeerConnection(config.rtcConfig);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            onIceCandidateCallback(event.candidate);
        }
    };

    peerConnection.ontrack = event => {
        config.logCallback(`[WEBRTC] Received remote track: ${event.track.kind}`);
        remoteStream.addTrack(event.track);
        config.onTrackCallback(event.track, remoteStream);
    };
    
    peerConnection.oniceconnectionstatechange = () => {
        config.onConnectionStateChangeCallback(peerConnection.iceConnectionState);
    };

    peerConnection.ondatachannel = (event) => {
        config.logCallback('[DC] Received remote DataChannel.');
        dataChannel = event.channel;
        setupDataChannelEvents(dataChannel);
    };

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        config.logCallback("[WEBRTC] Local tracks added to PeerConnection.");
    } else {
        config.logCallback("[WEBRTC] No local stream available to add tracks.");
    }
}

export async function startCall(localStream, targetId, isCaller, callType) {
    await createPeerConnectionInternal(localStream, (candidate) => {
        config.sendMessageCallback({ type: 'candidate', data: { target_id: targetId, candidate: candidate } });
    });

    if (isCaller) {
        config.logCallback('[DC] Creating DataChannel.');
        dataChannel = peerConnection.createDataChannel('control');
        setupDataChannelEvents(dataChannel);

        const offerOptions = {
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video'
        };
        config.logCallback(`[WEBRTC] Creating Offer with options: ${JSON.stringify(offerOptions)}`);
        const offer = await peerConnection.createOffer(offerOptions);
        await peerConnection.setLocalDescription(offer);
        config.sendMessageCallback({ type: 'offer', data: { target_id: targetId, offer: offer } });
    }
}

export async function handleOffer(offerData, localStream) {
    config.logCallback("[WEBRTC] Received Offer, creating Answer.");
    if (!peerConnection) {
        await createPeerConnectionInternal(localStream, (candidate) => {
            config.sendMessageCallback({ type: 'candidate', data: { target_id: offerData.from, candidate: candidate } });
        });
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerData.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    config.sendMessageCallback({ type: 'answer', data: { target_id: offerData.from, answer: answer } });
    processIceCandidateQueue();
}

export async function handleAnswer(answerData) {
    config.logCallback("[WEBRTC] Received Answer.");
    if (peerConnection && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData.answer));
        processIceCandidateQueue();
    }
}

export function handleCandidate(candidateData) {
    if (candidateData.candidate) {
        const candidate = new RTCIceCandidate(candidateData.candidate);
        if (peerConnection && peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(candidate).catch(e => config.logCallback(`[WEBRTC] Error adding ICE candidate: ${e}`));
        } else {
            iceCandidateQueue.push(candidate);
            config.logCallback("[WEBRTC] Queued an ICE candidate.");
        }
    }
}

export function closeConnection() {
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
    iceCandidateQueue = [];
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }
    config.logCallback('[WEBRTC] Connection closed and resources cleaned up.');
}

export function sendOnDataChannel(message) {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(message));
        return true;
    }
    return false;
}

export async function replaceVideoTrack(newTrack) {
    if (!peerConnection) return;
    const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
        await sender.replaceTrack(newTrack);
    }
}

export function getPeerConnection() {
    return peerConnection;
}