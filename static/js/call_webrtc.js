const PREVENT_P2P_DOWNGRADE = true;

let peerConnection;
let remoteStream;
let dataChannel;
let iceCandidateQueue = [];
let rtcConfig = null;
let connectionStatsInterval = null;
let lastRtcStats = null;
let iceServerDetails = {};
let currentConnectionDetails = null;
let currentConnectionType = 'unknown';
let iceRestartTimeoutId = null;

// Зависимости, которые будут переданы из main.js
let signalingSender;
let uiCallbacks;
let logger;

const connectionLogger = {
    isDataSent: false,
    data: {},
    reset: function(roomId, userId, isInitiator) {
        this.isDataSent = false;
        this.data = {
            roomId: roomId,
            userId: userId,
            isCallInitiator: isInitiator,
            probeResults: [],
            selectedConnection: null
        };
    },
    setProbeResults: function(results) {
        this.data.probeResults = results;
    },
    sendProbeLog: function() {
        if (this.isDataSent || !this.data.isCallInitiator) return;
        this.isDataSent = true;
        logger('[LOGGER] Sending probe-only log for failed connection attempt.');
        fetch('/api/log/connection-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.data)
        }).catch(error => console.error('Failed to send connection log:', error));
    },
    analyzeAndSend: async function() {
        if (this.isDataSent || !peerConnection) return;
        if (!this.data.isCallInitiator) {
            logger('[LOGGER] Not the call initiator, skipping log submission.');
            return;
        }
        this.isDataSent = true;

        logger('[LOGGER] Starting final analysis of connection stats...');
        try {
            const stats = await peerConnection.getStats();
            const statsMap = new Map();
            stats.forEach(report => statsMap.set(report.id, report));
            
            let activePair = null;
            statsMap.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    activePair = report;
                }
            });

            if (activePair) {
                const local = statsMap.get(activePair.localCandidateId);
                const remote = statsMap.get(activePair.remoteCandidateId);
                const rtt = activePair.currentRoundTripTime * 1000;
                let explanation = 'Не удалось определить причину выбора.';

                if (local.candidateType === 'host' && remote.candidateType === 'host') {
                    explanation = 'Выбран наилучший путь: прямое соединение в локальной сети (host-to-host). Это обеспечивает минимальную задержку.';
                } else if (local.candidateType === 'relay' || remote.candidateType === 'relay') {
                    explanation = 'Выбран запасной вариант: соединение через ретрансляционный TURN-сервер (relay). Прямое соединение невозможно, трафик пойдет через посредника, что может увеличить задержку.';
                } else if (['srflx', 'prflx'].includes(local.candidateType) || ['srflx', 'prflx'].includes(remote.candidateType)) {
                    if (rtt < 20) {
                        explanation = 'Выбран быстрый P2P-путь, характерный для сложных локальных сетей (например, с VPN или Docker). Низкий RTT подтверждает, что трафик не покидает локальную сеть.';
                    } else {
                        explanation = 'Выбран оптимальный путь: прямое P2P соединение через интернет. STUN-сервер или сам пир помог устройствам "увидеть" друг друга за NAT.';
                    }
                }

                this.data.selectedConnection = {
                    local: {
                        type: local.candidateType,
                        address: `${local.address || local.ip}:${local.port}`,
                        protocol: local.protocol,
                        server: local.url || 'N/A (Host Candidate)'
                    },
                    remote: {
                        type: remote.candidateType,
                        address: `${remote.address || remote.ip}:${remote.port}`,
                        protocol: remote.protocol,
                    },
                    rtt: activePair.currentRoundTripTime,
                    explanation: explanation
                };
            }

            logger('[LOGGER] Analysis complete. Sending connection details to server.');
            fetch('/api/log/connection-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.data)
            }).catch(error => console.error('Failed to send connection log:', error));

        } catch (e) {
            logger(`[LOGGER] Error during stats analysis: ${e}`);
        }
    }
};

function parseCandidate(candString) {
    const parts = candString.split(' ');
    return {
        type: parts[7],
        address: parts[4],
        port: parts[5],
        protocol: parts[2]
    };
}

async function probeIceServers() {
    logger('[PROBE] Starting ICE server probing...');
    const serversToProbe = rtcConfig.iceServers;
    const promises = serversToProbe.map(server => {
        return new Promise(resolve => {
            const startTime = performance.now();
            let tempPC;
            let resolved = false;

            const resolvePromise = (status, candidateObj, rtt) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                if (tempPC && tempPC.signalingState !== 'closed') {
                    tempPC.close();
                }
                resolve({ url: server.urls, status, rtt, candidate: candidateObj });
            };

            const timeout = setTimeout(() => {
                resolvePromise('No Response', null, null);
            }, 2500);

            try {
                tempPC = new RTCPeerConnection({ iceServers: [server] });

                tempPC.onicecandidate = (e) => {
                    if (e.candidate) {
                        const rtt = performance.now() - startTime;
                        const candidateData = { ...parseCandidate(e.candidate.candidate), raw: e.candidate.candidate };
                        resolvePromise('Responded', candidateData, rtt);
                    }
                };
                
                tempPC.onicegatheringstatechange = () => {
                    if (tempPC.iceGatheringState === 'complete' && !resolved) {
                         resolvePromise('No Candidates', null, performance.now() - startTime);
                    }
                };

                tempPC.createDataChannel('probe');
                tempPC.createOffer()
                    .then(offer => tempPC.setLocalDescription(offer))
                    .catch(() => resolvePromise('Error', null, null));

            } catch (error) {
                resolvePromise('Config Error', null, null);
            }
        });
    });

    let results = await Promise.all(promises);
    results.sort((a, b) => {
        if (a.rtt === null) return 1;
        if (b.rtt === null) return -1;
        return a.rtt - b.rtt;
    });

    logger(`[PROBE] Probing complete. ${results.filter(r => r.status === 'Responded').length} servers responded.`);
    return results;
}

function setupDataChannelEvents(channel) {
    channel.onopen = () => logger('[DC] DataChannel is open.');
    channel.onclose = () => logger('[DC] DataChannel is closed.');
    channel.onerror = (error) => logger(`[DC] DataChannel error: ${error}`);
    channel.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            logger(`[DC] Received message: ${message.type}`);
            if (message.type === 'hangup') {
                uiCallbacks.onHangupReceived();
            } else if (message.type === 'mute_status') {
                uiCallbacks.onRemoteMute(message.muted);
            }
        } catch (e) {
            logger(`[DC] Received non-JSON message: ${event.data}`);
        }
    };
}

async function createPeerConnectionInternal(localUserStream, isInitiator, roomId, userId) {
    logger("[WEBRTC] Creating RTCPeerConnection.");
    if (!rtcConfig) {
        logger("[CRITICAL] rtcConfig is not available.");
        alert("Ошибка конфигурации сети. Пожалуйста, обновите страницу.");
        return;
    }

    connectionLogger.reset(roomId, userId, isInitiator);
    if (isInitiator) {
        const probeResults = await probeIceServers();
        connectionLogger.setProbeResults(probeResults);
    }

    if (peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection(rtcConfig);
    remoteStream = new MediaStream();
    uiCallbacks.setupRemoteStream(remoteStream);

    peerConnection.ondatachannel = (event) => {
        logger('[DC] Received remote DataChannel.');
        dataChannel = event.channel;
        setupDataChannelEvents(dataChannel);
    };

    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        logger(`[WEBRTC] ICE State: ${state}`);
        
        if (state === 'connected') {
            connectionLogger.analyzeAndSend();
            if (iceRestartTimeoutId) {
                clearTimeout(iceRestartTimeoutId);
                iceRestartTimeoutId = null;
                logger('[WEBRTC] Connection recovered before ICE Restart was initiated.');
            }
        } else if (state === 'disconnected') {
            logger('[WEBRTC] Connection is disconnected. Scheduling ICE Restart check.');
            if (iceRestartTimeoutId) clearTimeout(iceRestartTimeoutId);
            iceRestartTimeoutId = setTimeout(() => {
                if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
                    logger('[WEBRTC] Connection did not recover. Initiating ICE Restart.');
                    initiateIceRestart();
                }
            }, 5000);
        } else if (state === 'failed') {
            logger(`[WEBRTC] P2P connection failed. Ending call.`);
            uiCallbacks.onConnectionFailed();
        }
    };

    peerConnection.onsignalingstatechange = () => logger(`[WEBRTC] Signaling State: ${peerConnection.signalingState}`);
    
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
           const isRelayCandidate = event.candidate.candidate.includes(" typ relay ");
            
            if (PREVENT_P2P_DOWNGRADE && currentConnectionType === 'p2p' && isRelayCandidate) {
                logger(`[WEBRTC_POLICY] Blocking TURN candidate to prevent downgrade from P2P.`);
                return; 
            }
            signalingSender({ type: 'candidate', candidate: event.candidate });
        }
    };

    peerConnection.ontrack = event => {
        logger(`[WEBRTC] Received remote track: ${event.track.kind}`);
        remoteStream.addTrack(event.track);
        if (event.track.kind === 'audio') {
            uiCallbacks.visualizeRemoteMic(remoteStream);
        }
    };

    if (localUserStream) {
        localUserStream.getTracks().forEach(track => peerConnection.addTrack(track, localUserStream));
        logger("[WEBRTC] Local tracks added to PeerConnection.");
    } else {
        logger("[WEBRTC] No local stream available to add tracks.");
    }
}

async function processIceCandidateQueue() {
    while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        try {
            await peerConnection.addIceCandidate(candidate);
            logger("[WEBRTC] Added a queued ICE candidate.");
        } catch (e) {
            logger(`[WEBRTC] ERROR adding queued ICE candidate: ${e}`);
        }
    }
}

async function monitorConnectionStats() {
    if (!peerConnection || peerConnection.iceConnectionState !== 'connected') return;
    try {
        const stats = await peerConnection.getStats();
        let activeCandidatePair = null, remoteInboundRtp = null;
        stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') activeCandidatePair = report;
            if (report.type === 'remote-inbound-rtp' && (report.kind === 'video' || !remoteInboundRtp)) remoteInboundRtp = report;
        });

        if (activeCandidatePair?.localCandidateId) {
            const localCand = stats.get(activeCandidatePair.localCandidateId);
            const remoteCand = stats.get(activeCandidatePair.remoteCandidateId);

            if (localCand?.candidateType && remoteCand?.candidateType) {
                const localType = localCand.candidateType;
                const remoteType = remoteCand.candidateType;
                
                let connectionTypeForIcon = 'unknown';
                if (localType === 'relay' || remoteType === 'relay') {
                    connectionTypeForIcon = 'relay';
                    currentConnectionType = 'relay';
                    const relayCandidate = localType === 'relay' ? localCand : remoteCand;
                    if (relayCandidate.url && iceServerDetails[relayCandidate.url]) {
                        currentConnectionDetails = iceServerDetails[relayCandidate.url];
                    }
                } else if (localType === 'host' && remoteType === 'host') {
                    connectionTypeForIcon = 'local';
                    currentConnectionType = 'p2p'; 
                    currentConnectionDetails = { region: 'local', provider: 'network' };
                } else {
                    connectionTypeForIcon = 'p2p';
                    currentConnectionType = 'p2p';
                    let details = { region: 'direct', provider: 'p2p' };
                    if (localCand.url && iceServerDetails[localCand.url]) {
                        const serverInfo = iceServerDetails[localCand.url];
                        details = { region: serverInfo.region, provider: `p2p (via ${serverInfo.provider})` };
                    }
                    currentConnectionDetails = details;
                }
                uiCallbacks.updateConnectionIcon(connectionTypeForIcon, currentConnectionDetails);
            } else {
                uiCallbacks.updateConnectionIcon('unknown', null);
                currentConnectionType = 'unknown';
                currentConnectionDetails = null;
            }
        }

        let quality = 'unknown';
        if (remoteInboundRtp && activeCandidatePair) {
            const roundTripTime = activeCandidatePair.currentRoundTripTime * 1000;
            const jitter = remoteInboundRtp.jitter * 1000;
            let packetsLostDelta = 0;
            if (lastRtcStats?.remoteInboundRtp) {
                const packetsLostNow = remoteInboundRtp.packetsLost || 0;
                const packetsReceivedNow = remoteInboundRtp.packetsReceived || 0;
                const packetsLostBefore = lastRtcStats.remoteInboundRtp.packetsLost || 0;
                const packetsReceivedBefore = lastRtcStats.remoteInboundRtp.packetsReceived || 0;
                const totalPacketsSinceLast = (packetsReceivedNow - packetsReceivedBefore) + (packetsLostNow - packetsLostBefore);
                if (totalPacketsSinceLast > 0) packetsLostDelta = (packetsLostNow - packetsLostBefore) / totalPacketsSinceLast;
            }
            let score = (roundTripTime < 150) + (jitter < 50) + (packetsLostDelta < 0.02);
            if (score === 3) quality = 'good';
            else if (score >= 1) quality = 'medium';
            else quality = 'bad';
            logger(`[STATS] Quality: rtt=${roundTripTime.toFixed(0)}ms, jitter=${jitter.toFixed(2)}ms, loss=${(packetsLostDelta*100).toFixed(2)}% -> ${quality}`);
        }
        uiCallbacks.updateConnectionQualityIcon(quality);
        lastRtcStats = { remoteInboundRtp };
    } catch (error) {
        logger(`Error getting connection stats: ${error}`);
    }
}

async function initiateIceRestart() {
    if (!peerConnection) return;
    logger('[WEBRTC] Creating new offer with iceRestart: true');
    try {
        const offer = await peerConnection.createOffer({ iceRestart: true });
        await peerConnection.setLocalDescription(offer);
        signalingSender({ type: 'offer', offer: offer });
    } catch (error) {
        logger(`[WEBRTC] ICE Restart failed: ${error}`);
        uiCallbacks.onConnectionFailed();
    }
}

// --- Public API for the module ---

export function init(config, sender, callbacks, logFunc) {
    rtcConfig = config.rtc;
    iceServerDetails = config.details;
    signalingSender = sender;
    uiCallbacks = callbacks;
    logger = logFunc;
}

export async function startConnection(isCaller, callType, localUserStream, roomId, userId) {
    logger(`[WEBRTC] Starting PeerConnection. Is caller: ${isCaller}`);
    await createPeerConnectionInternal(localUserStream, isCaller, roomId, userId);

    if (isCaller) {
        logger('[DC] Creating DataChannel.');
        dataChannel = peerConnection.createDataChannel('control');
        setupDataChannelEvents(dataChannel);

        const offerOptions = {
            offerToReceiveAudio: true, 
            offerToReceiveVideo: callType === 'video' 
        };
        logger(`[WEBRTC] Creating Offer with options: ${JSON.stringify(offerOptions)}`);
        const offer = await peerConnection.createOffer(offerOptions);

        await peerConnection.setLocalDescription(offer);
        signalingSender({ type: 'offer', offer: offer });
    }
}

export async function handleRemoteOffer(offer, fromId, localUserStream, roomId, userId) {
    logger("[WEBRTC] Received Offer, creating Answer.");
    if (!peerConnection) {
        await startConnection(false, null, localUserStream, roomId, userId);
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    signalingSender({ type: 'answer', answer: answer });
    
    uiCallbacks.onCallConnected();
    processIceCandidateQueue();
}

export async function handleRemoteAnswer(answer) {
    logger("[WEBRTC] Received Answer.");
    if (peerConnection && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        uiCallbacks.onCallConnected();
        processIceCandidateQueue();
    }
}

export async function handleRemoteCandidate(candidate) {
    if (candidate) {
        const iceCandidate = new RTCIceCandidate(candidate);
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(iceCandidate);
        } else {
            iceCandidateQueue.push(iceCandidate);
            logger("[WEBRTC] Queued an ICE candidate.");
        }
    }
}

export function closeConnection(isInitiator) {
    currentConnectionType = 'unknown';
    if (isInitiator && dataChannel && dataChannel.readyState === 'open') {
        logger('[DC] Sending hangup via DataChannel.');
        dataChannel.send(JSON.stringify({ type: 'hangup' }));
    }
    
    if (isInitiator && !connectionLogger.isDataSent) {
        connectionLogger.sendProbeLog();
    }

    if (connectionStatsInterval) clearInterval(connectionStatsInterval);
    if (iceRestartTimeoutId) clearTimeout(iceRestartTimeoutId);
    lastRtcStats = null;
    iceRestartTimeoutId = null;
    currentConnectionDetails = null;

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
    logger('[WEBRTC] Connection closed and resources cleaned up.');
}

export function getStats() {
    if (!peerConnection) return null;
    return peerConnection.getStats();
}

export function getDataChannel() {
    return dataChannel;
}