
let log = () => {};
let getPeerConnection = () => null;
let updateConnectionIcon = () => {};
let updateConnectionQualityIcon = () => {};
let showConnectionToast = () => {};
let getIceServerDetails = () => ({});
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
    onConnectionEstablished = callbacks.onConnectionEstablished;
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
    connectionStatsInterval = setInterval(monitorConnectionStats, 900);
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