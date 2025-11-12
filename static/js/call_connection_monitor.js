let log = () => {};
let getPeerConnection = () => null;
let updateConnectionIcon = () => {};
let updateConnectionQualityIcon = () => {};
let showConnectionToast = () => {};
let getIceServerDetails = () => ({});
let getRtcConfig = () => ({});
let onConnectionEstablished = () => {};

let lastRtcStats = null;
let currentConnectionDetails = null;
let connectionStatsInterval = null;
let initialConnectionToastShown = false;
let currentConnectionType = 'unknown';
let connectionTypeReported = false;

export function init(callbacks) {
    log = callbacks.log;
    getPeerConnection = callbacks.getPeerConnection;
    updateConnectionIcon = callbacks.updateConnectionIcon;
    updateConnectionQualityIcon = callbacks.updateConnectionQualityIcon;
    showConnectionToast = callbacks.showConnectionToast;
    getIceServerDetails = callbacks.getIceServerDetails;
    getRtcConfig = callbacks.getRtcConfig;
    onConnectionEstablished = callbacks.onConnectionEstablished;
}

export const connectionLogger = {
    isDataSent: false,
    data: {},
    reset: function(roomId, userId, isCallInitiator) {
        this.isDataSent = false;
        this.data = {
            roomId: roomId,
            userId: userId,
            isCallInitiator: isCallInitiator,
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
        log('[LOGGER] Sending probe-only log for failed connection attempt.');
        fetch('/api/log/connection-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.data)
        }).catch(error => console.error('Failed to send connection log:', error));
    },
    analyzeAndSend: async function() {
        if (this.isDataSent) return;
        const peerConnection = getPeerConnection();
        if (!peerConnection) return;

        if (!this.data.isCallInitiator) {
            log('[LOGGER] Not the call initiator, skipping log submission.');
            return;
        }
        this.isDataSent = true;

        log('[LOGGER] Starting final analysis of connection stats...');
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
                const rtt = activePair.currentRoundTripTime;
                let explanation = 'Не удалось определить причину выбора.';

                if (local.candidateType === 'host' && remote.candidateType === 'host') {
                    explanation = 'Выбран наилучший путь: прямое соединение в локальной сети (host-to-host). Это обеспечивает минимальную задержку.';
                } else if (local.candidateType === 'relay' || remote.candidateType === 'relay') {
                    explanation = 'Выбран запасной вариант: соединение через ретрансляционный TURN-сервер (relay). Прямое соединение невозможно, трафик пойдет через посредника, что может увеличить задержку.';
                } else if (['srflx', 'prflx'].includes(local.candidateType) || ['srflx', 'prflx'].includes(remote.candidateType)) {
                    if (rtt * 1000 < 20) {
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
                    rtt: rtt,
                    explanation: explanation
                };
            }

            log('[LOGGER] Analysis complete. Sending connection details to server.');
            fetch('/api/log/connection-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.data)
            }).catch(error => console.error('Failed to send connection log:', error));

        } catch (e) {
            log(`[LOGGER] Error during stats analysis: ${e}`);
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

export async function probeIceServers() {
    log('[PROBE] Starting ICE server probing...');
    const rtcConfig = getRtcConfig();
    if (!rtcConfig || !rtcConfig.iceServers) {
        log('[PROBE] RTC config not available for probing.');
        return [];
    }
    const serversToProbe = rtcConfig.iceServers;
    const promises = serversToProbe.map(server => {
        return new Promise(resolve => {
            const startTime = performance.now();
            let tempPC;
            let resolved = false;
            let gatheredCandidates = [];

            const resolvePromise = (status, candidate, rtt) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                if (tempPC && tempPC.signalingState !== 'closed') {
                    tempPC.close();
                }
                const candidateObj = candidate ? { ...parseCandidate(candidate.candidate), raw: candidate.candidate } : null;
                resolve({ url: server.urls, status, rtt, candidate: candidateObj });
            };

            const timeout = setTimeout(() => {
                resolvePromise('No Response', null, null);
            }, 3000);

            try {
                tempPC = new RTCPeerConnection({ iceServers: [server] });

                tempPC.onicecandidate = (e) => {
                    if (e.candidate) {
                        gatheredCandidates.push(e.candidate);
                    }
                };
                
                tempPC.onicegatheringstatechange = () => {
                    if (tempPC.iceGatheringState === 'complete') {
                        const rtt = performance.now() - startTime;
                        if (gatheredCandidates.length === 0) {
                            resolvePromise('No Candidates', null, rtt);
                        } else {
                            const bestCandidate = 
                                gatheredCandidates.find(c => c.type === 'relay') ||
                                gatheredCandidates.find(c => c.type === 'srflx') ||
                                gatheredCandidates[0];
                            resolvePromise('Responded', bestCandidate, rtt);
                        }
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

    log(`[PROBE] Probing complete. ${results.filter(r => r.status === 'Responded').length} servers responded.`);
    return results;
}

async function monitorConnectionStats() {
    const peerConnection = getPeerConnection();
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
            const iceServerDetails = getIceServerDetails();

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
                } 
                else if (localType === 'host' && remoteType === 'host') {
                    connectionTypeForIcon = 'local';
                    currentConnectionType = 'p2p'; 
                    currentConnectionDetails = { region: 'local', provider: 'network' };
                }
                else {
                    connectionTypeForIcon = 'p2p';
                    currentConnectionType = 'p2p';
                    let details = { region: 'direct', provider: 'p2p' };
                    if (localCand.url && iceServerDetails[localCand.url]) {
                        const serverInfo = iceServerDetails[localCand.url];
                        details = { 
                            region: serverInfo.region, 
                            provider: `p2p (via ${serverInfo.provider})` 
                        };
                    }
                    currentConnectionDetails = details;
                }
                
                updateConnectionIcon(connectionTypeForIcon);

                if (!connectionTypeReported) {
                    onConnectionEstablished(currentConnectionType);
                    connectionTypeReported = true;
                }

                if (!initialConnectionToastShown && peerConnection.iceConnectionState === 'connected') {
                    initialConnectionToastShown = true;
                    if (connectionTypeForIcon === 'p2p' || connectionTypeForIcon === 'local') {
                        showConnectionToast('good', 'Установлено прямое P2P-соединение.');
                    } else if (connectionTypeForIcon === 'relay') {
                        showConnectionToast('warning', 'Соединение через сервер.');
                    }
                }

            } else {
                updateConnectionIcon('unknown');
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
            log(`[STATS] Quality: rtt=${roundTripTime.toFixed(0)}ms, jitter=${jitter.toFixed(2)}ms, loss=${(packetsLostDelta*100).toFixed(2)}% -> ${quality}`);
        }
        updateConnectionQualityIcon(quality);
        lastRtcStats = { remoteInboundRtp };
    } catch (error) {
        log(`Error getting connection stats: ${error}`);
    }
}

export function startConnectionMonitoring() {
    if (connectionStatsInterval) clearInterval(connectionStatsInterval);
    connectionStatsInterval = setInterval(monitorConnectionStats, 3000);
    initialConnectionToastShown = false;
    connectionTypeReported = false;
    updateConnectionIcon('unknown');
    updateConnectionQualityIcon('unknown');
}

export function stopConnectionMonitoring() {
    if (connectionStatsInterval) clearInterval(connectionStatsInterval);
    connectionStatsInterval = null;
    lastRtcStats = null;
    currentConnectionDetails = null;
    currentConnectionType = 'unknown';
    initialConnectionToastShown = false;
    connectionTypeReported = false;
    updateConnectionQualityIcon('unknown');
    updateConnectionIcon('unknown');
}

export function getCurrentConnectionType() {
    return currentConnectionType;
}

export function getCurrentConnectionDetails() {
    return currentConnectionDetails;
}