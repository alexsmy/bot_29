
import {
previewVideo, micLevelBars, continueToCallBtn, continueSpectatorBtn, cameraSelect,
micSelect, speakerSelect, cameraSelectContainer, micSelectContainer, speakerSelectContainer,
lifetimeTimer, callScreen, localGlow, remoteGlow,
callerName, incomingCallType,
localAudio, remoteAudio, localVideo, remoteVideo,
localVideoContainer, ringOutAudio, connectAudio, ringInAudio,
deviceSettingsModal, cameraSelectCall, micSelectCall, speakerSelectCall,
cameraSelectContainerCall, micSelectContainerCall, speakerSelectContainerCall,
initUI, showScreen, showModal, showPopup, updateCallUI, setupVideoCallUiListeners,
removeVideoCallUiListeners, startTimer, stopTimer, visualizeMic, visualizeLocalMicForCall,
visualizeRemoteMic, updateStatusIndicators, displayMediaErrors, updateConnectionIcon,
updateConnectionQualityIcon, showConnectionInfo, showConnectionToast, setupEventListeners as setupUiEventListeners
} from './call_ui.js';

const tg = window.Telegram.WebApp;

const PREVENT_P2P_DOWNGRADE = true;

let ws;
let peerConnection;
let localStream;
let remoteStream;
let dataChannel;
let previewStream;
let micVisualizer = null;
let localCallMicVisualizer = null;
let remoteMicVisualizer = null;
let currentUser = {};
let targetUser = {};
let currentCallType = 'audio';
let callTimerInterval = null;
let lifetimeTimerInterval = null;
let uiFadeTimeout = null;
let isSpeakerMuted = false;
let isMuted = false;
let isVideoEnabled = true;
let hasMicrophoneAccess = false;
let hasCameraAccess = false;
let isSpectator = false;
let roomId = '';
let iceCandidateQueue = [];
let rtcConfig = null;
let connectionStatsInterval = null;
let lastRtcStats = null;
let isScreenSharing = false;
let screenStream = null;
let originalVideoTrack = null;
let videoDevices = [];
let audioInDevices = [];
let audioOutDevices = [];
let selectedVideoId = null;
let selectedAudioInId = null;
let selectedAudioOutId = null;
let iceServerDetails = {};
let currentConnectionDetails = null;
let isCallInitiator = false;
let isEndingCall = false;
let initialConnectionToastShown = false;

let currentConnectionType = 'unknown';

const connectionLogger = {
isDataSent: false,
data: {},
reset: function() {
this.isDataSent = false;
this.data = {
roomId: roomId,
userId: currentUser.id,
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
logToScreen('[LOGGER] Sending probe-only log for failed connection attempt.');
fetch('/api/log/connection-details', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(this.data)
}).catch(error => console.error('Failed to send connection log:', error));
},
analyzeAndSend: async function() {
if (this.isDataSent || !peerConnection) return;
if (!this.data.isCallInitiator) {
logToScreen('[LOGGER] Not the call initiator, skipping log submission.');
return;
}
this.isDataSent = true;

code
Code
download
content_copy
expand_less
logToScreen('[LOGGER] Starting final analysis of connection stats...');
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

        logToScreen('[LOGGER] Analysis complete. Sending connection details to server.');
        fetch('/api/log/connection-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.data)
        }).catch(error => console.error('Failed to send connection log:', error));

    } catch (e) {
        logToScreen(`[LOGGER] Error during stats analysis: ${e}`);
    }
}

};

async function probeIceServers() {
logToScreen('[PROBE] Starting ICE server probing...');
const serversToProbe = rtcConfig.iceServers;
const promises = serversToProbe.map(server => {
return new Promise(resolve => {
const startTime = performance.now();
let tempPC;
let resolved = false;

code
Code
download
content_copy
expand_less
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

logToScreen(`[PROBE] Probing complete. ${results.filter(r => r.status === 'Responded').length} servers responded.`);
return results;

}

function parseCandidate(candString) {
const parts = candString.split(' ');
if (parts.length < 8) return {};
return {
type: parts,
address: parts,
port: parts,
protocol: parts
};
}

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectTimeoutId = null;
let iceRestartTimeoutId = null;
let isGracefulDisconnect = false;

function sendLogToServer(message) {
if (!currentUser || !currentUser.id || !roomId) return;
fetch('/log', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
user_id: String(currentUser.id || 'pre-id'),
room_id: String(roomId),
message: message
})
}).catch(error => console.error('Failed to send log to server:', error));
}

function logToScreen(message) {
const now = new Date();
const time = ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')};
const logMessage = [${time}] ${message};
console.log(logMessage);
sendLogToServer(logMessage);
}

document.addEventListener('DOMContentLoaded', async () => {
initUI(); // Initialize all DOM element variables

code
Code
download
content_copy
expand_less
const path = window.location.pathname;
logToScreen(`App loaded. Path: ${path}`);

try {
    logToScreen("Fetching ICE servers configuration from server...");
    const response = await fetch('/api/ice-servers');
    if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
    }
    const servers = await response.json();
    
    const peerConnectionConfig = servers.map(s => ({
        urls: s.urls,
        username: s.username,
        credential: s.credential
    }));
    rtcConfig = { iceServers: peerConnectionConfig, iceCandidatePoolSize: 10 };

    servers.forEach(s => {
        let provider = 'Unknown';
        if (s.source) {
            try {
                provider = new URL(s.source).hostname.replace(/^www\./, '');
            } catch (e) { provider = s.source; }
        } else if (s.provider) {
            provider = s.provider;
        }
        iceServerDetails[s.urls] = {
            region: s.region || 'global',
            provider: provider
        };
    });

    logToScreen("ICE servers configuration and details loaded successfully.");
} catch (error) {
    logToScreen(`[CRITICAL] Failed to fetch ICE servers: ${error.message}. Falling back to public STUN.`);
    alert("Не удалось загрузить конфигурацию сети. Качество звонка может быть низким.");
    rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ]
    };
}

if (path.startsWith('/call/')) {
    const parts = path.split('/');
    roomId = parts; // CORRECTED
    initializePrivateCallMode();
} else {
    document.body.innerHTML = "<h1>Неверный URL</h1>";
}

});

function initializePrivateCallMode() {
logToScreen(Initializing in Private Call mode for room: ${roomId});
setupUiEventListeners(eventHandlers);
runPreCallCheck();
}

async function runPreCallCheck() {
showScreen('pre-call-check');
let stream;
try {
stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
hasCameraAccess = true;
hasMicrophoneAccess = true;
} catch (error) {
logToScreen([MEDIA_CHECK] Combined media request failed: ${error.name}. Trying separately.);
const results = await Promise.allSettled([
navigator.mediaDevices.getUserMedia({ video: true }),
navigator.mediaDevices.getUserMedia({ audio: true })
]);
const videoResult = results;
const audioResult = results;

code
Code
download
content_copy
expand_less
if (videoResult.status === 'fulfilled') {
        hasCameraAccess = true;
        stream = videoResult.value;
    }
    if (audioResult.status === 'fulfilled') {
        hasMicrophoneAccess = true;
        if (stream) {
            audioResult.value.getAudioTracks().forEach(track => stream.addTrack(track));
        } else {
            stream = audioResult.value;
        }
    }
    displayMediaErrors(error);
    continueSpectatorBtn.style.display = 'block';
}

updateStatusIndicators(hasCameraAccess, hasMicrophoneAccess);

if (stream) {
    previewStream = stream;
    previewVideo.srcObject = stream;
    if (hasMicrophoneAccess) micVisualizer = visualizeMic(stream, micLevelBars);
    await populateDeviceSelectors();
    continueToCallBtn.disabled = false;
} else {
    logToScreen('[MEDIA_CHECK] No media devices available or access denied to all.');
}

}

async function populateDeviceSelectors() {
const devices = await navigator.mediaDevices.enumerateDevices();
videoDevices = devices.filter(d => d.kind === 'videoinput');
audioInDevices = devices.filter(d => d.kind === 'audioinput');
audioOutDevices = devices.filter(d => d.kind === 'audiooutput');

code
Code
download
content_copy
expand_less
const populate = (select, devicesList, container) => {
    if (devicesList.length === 0) return;
    select.innerHTML = '';
    devicesList.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `${select.id} ${select.options.length + 1}`;
        select.appendChild(option);
    });
    container.style.display = 'flex';
};

populate(cameraSelect, videoDevices, cameraSelectContainer);
populate(micSelect, audioInDevices, micSelectContainer);
populate(speakerSelect, audioOutDevices, speakerSelectContainer);

selectedVideoId = cameraSelect.value;
selectedAudioInId = micSelect.value;
selectedAudioOutId = speakerSelect.value;

}

async function updatePreviewStream() {
if (previewStream) {
previewStream.getTracks().forEach(track => track.stop());
}
if (micVisualizer) {
cancelAnimationFrame(micVisualizer.id);
micVisualizer.context.close();
micVisualizer = null;
}

code
Code
download
content_copy
expand_less
selectedVideoId = cameraSelect.value;
selectedAudioInId = micSelect.value;
selectedAudioOutId = speakerSelect.value;

const constraints = {
    audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
    video: hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
};

if (!constraints.audio && !constraints.video) return;

try {
    previewStream = await navigator.mediaDevices.getUserMedia(constraints);
    previewVideo.srcObject = previewStream;
    if (hasMicrophoneAccess) micVisualizer = visualizeMic(previewStream, micLevelBars);
} catch (error) {
    logToScreen(`[MEDIA_UPDATE] Error updating preview stream: ${error}`);
}

}

function proceedToCall(asSpectator = false) {
isSpectator = asSpectator;
logToScreen(Proceeding to call screen. Spectator mode: ${isSpectator});
if (previewStream) {
previewStream.getTracks().forEach(track => track.stop());
}
if (micVisualizer) {
cancelAnimationFrame(micVisualizer.id);
micVisualizer.context.close();
micVisualizer = null;
}

code
Code
download
content_copy
expand_less
showScreen('pre-call');
showPopup('waiting');
connectWebSocket();
updateRoomLifetime();
lifetimeTimerInterval = setInterval(updateRoomLifetime, 60000);

}

function connectWebSocket() {
isGracefulDisconnect = false;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = ${protocol}//${window.location.host}/ws/private/${roomId};
logToScreen([WS] Attempting a new connection to ${wsUrl});

code
Code
download
content_copy
expand_less
ws = new WebSocket(wsUrl);

ws.onopen = () => {
    logToScreen("[WS] WebSocket connection established.");
    reconnectAttempts = 0;
    if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
    }
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    logToScreen(`[WS] Received message: ${message.type}`);
    switch (message.type) {
        case 'identity':
            currentUser.id = message.data.id;
            logToScreen(`[WS] Identity assigned by server: ${currentUser.id}`);
            break;
        case 'user_list': handleUserList(message.data); break;
        case 'incoming_call': handleIncomingCall(message.data); break;
        case 'call_accepted': startPeerConnection(targetUser.id, true); break;
        case 'offer': handleOffer(message.data); break;
        case 'answer': handleAnswer(message.data); break;
        case 'candidate': handleCandidate(message.data); break;
        case 'call_ended': endCall(false, 'ended_by_peer'); break;
        case 'call_missed': alert("Абонент не отвечает."); endCall(false, 'no_answer'); break;
        case 'room_expired':
        case 'room_closed_by_user':
            alert("Комната для звонков была закрыта.");
            redirectToInvalidLink();
            break;
    }
};

ws.onclose = (event) => {
    logToScreen(`[WS] WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
    if (isGracefulDisconnect) {
        logToScreen("[WS] Disconnect was graceful. No reconnection needed.");
        return;
    }
    
    if (event.code === 1008) {
         alert(`Ошибка подключения: ${event.reason}. Эта ссылка, возможно, уже недействительна.`);
         redirectToInvalidLink();
    } else {
        handleWebSocketReconnect();
    }
};

ws.onerror = (error) => {
    logToScreen(`[WS] WebSocket error: ${JSON.stringify(error)}`);
    ws.close();
};

}

function handleWebSocketReconnect() {
if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
logToScreen([WS] Max reconnect attempts reached. Giving up.);
alert("Не удалось восстановить соединение с сервером. Пожалуйста, обновите страницу.");
return;
}

code
Code
download
content_copy
expand_less
reconnectAttempts++;
const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
logToScreen(`[WS] Will attempt to reconnect in ${delay / 1000} seconds (Attempt ${reconnectAttempts}).`);

reconnectTimeoutId = setTimeout(() => {
    connectWebSocket();
}, delay);

}

function sendMessage(message) {
if (ws && ws.readyState === WebSocket.OPEN) {
logToScreen([WS] Sending message: ${message.type});
ws.send(JSON.stringify(message));
} else {
logToScreen("[WS] ERROR: Attempted to send message on a closed connection. Message will be lost.");
}
}

function handleUserList(users) {
const otherUsers = users.filter(u => u.id !== currentUser.id);

code
Code
download
content_copy
expand_less
if (otherUsers.length === 0) {
    targetUser = {};
    showPopup('waiting');
} else {
    targetUser = otherUsers;
    if (targetUser.status === 'busy') {
        showPopup('initiating');
    } else {
        showPopup('actions');
    }
}

}

async function initiateCall(callType) {
if (!targetUser || !targetUser.id) {
logToScreen("[CALL] Error: Tried to initiate call but targetUser is not defined.");
return;
}
logToScreen([CALL] Initiating call to user ${targetUser.id}, type: ${callType});
isCallInitiator = true;
currentCallType = callType;

code
Code
download
content_copy
expand_less
if (currentCallType === 'video') {
    remoteVideo.play().catch(() => {});
}

const hasMedia = await initializeLocalMedia(currentCallType === 'video');
if (!hasMedia) logToScreen("[CALL] Proceeding with call without local media.");

sendMessage({ type: 'call_user', data: { target_id: targetUser.id, call_type: currentCallType } });

showScreen('call');
updateCallUI(currentCallType, hasCameraAccess, hasMicrophoneAccess, targetUser);
ringOutAudio.play();

}

function handleIncomingCall(data) {
logToScreen([CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type});
isCallInitiator = false;
targetUser = data.from_user;
currentCallType = data.call_type;

code
Code
download
content_copy
expand_less
callerName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
incomingCallType.textContent = currentCallType === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок';
showModal('incoming-call', true);
ringInAudio.play();

}

async function acceptCall() {
logToScreen("[CALL] 'Accept' button pressed.");
stopIncomingRing();
showModal('incoming-call', false);

code
Code
download
content_copy
expand_less
if (currentCallType === 'video') {
    remoteVideo.play().catch(() => {});
}

const hasMedia = await initializeLocalMedia(currentCallType === 'video');
if (!hasMedia) logToScreen("[CALL] No local media available, accepting as receive-only.");

logToScreen("[CALL] Starting WebRTC connection.");
await startPeerConnection(targetUser.id, false);
sendMessage({ type: 'call_accepted', data: { target_id: targetUser.id } });

}

function declineCall() {
logToScreen("[CALL] Declining call.");
stopIncomingRing();
showModal('incoming-call', false);
sendMessage({ type: 'call_declined', data: { target_id: targetUser.id } });
targetUser = {};
}

async function endCall(isInitiator, reason) {
if (isEndingCall) return;
isEndingCall = true;

code
Code
download
content_copy
expand_less
logToScreen(`[CALL] Ending call. Initiator: ${isInitiator}, Reason: ${reason}`);
isGracefulDisconnect = true;

currentConnectionType = 'unknown';

if (isInitiator && dataChannel && dataChannel.readyState === 'open') {
    logToScreen('[DC] Sending hangup via DataChannel.');
    dataChannel.send(JSON.stringify({ type: 'hangup' }));
}
if (isInitiator && targetUser.id) {
    sendMessage({ type: 'hangup', data: { target_id: targetUser.id } });
}

if (isInitiator && !connectionLogger.isDataSent) {
    connectionLogger.sendProbeLog();
}

if (connectionStatsInterval) clearInterval(connectionStatsInterval);
if (iceRestartTimeoutId) clearTimeout(iceRestartTimeoutId);
lastRtcStats = null;
iceRestartTimeoutId = null;
currentConnectionDetails = null;

if (isScreenSharing) {
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());
    isScreenSharing = false;
    screenStream = null;
    originalVideoTrack = null;
}

if (localCallMicVisualizer) {
    cancelAnimationFrame(localCallMicVisualizer.id);
    if(localCallMicVisualizer.context.state !== 'closed') localCallMicVisualizer.context.close();
    localCallMicVisualizer = null;
}
if (remoteMicVisualizer) {
    cancelAnimationFrame(remoteMicVisualizer.id);
    if(remoteMicVisualizer.context.state !== 'closed') remoteMicVisualizer.context.close();
    remoteMicVisualizer = null;
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
if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
}

ringOutAudio.pause(); ringOutAudio.currentTime = 0;
stopIncomingRing();

localAudio.srcObject = null;
remoteAudio.srcObject = null;
localVideo.srcObject = null;
remoteVideo.srcObject = null;

updateConnectionQualityIcon('unknown');
updateConnectionIcon('unknown');

callTimerInterval = stopTimer(callTimerInterval);
showModal('incoming-call', false);
showScreen('pre-call');

targetUser = {};
iceCandidateQueue = [];
resetCallControls();

}

async function initializeLocalMedia(isVideo) {
if (isSpectator) {
logToScreen("[MEDIA] Spectator mode, skipping media initialization.");
return false;
}
logToScreen([MEDIA] Requesting media. Video requested: ${isVideo});
if (localStream) localStream.getTracks().forEach(track => track.stop());

code
Code
download
content_copy
expand_less
const constraints = {
    audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
    video: isVideo && hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
};

if (!constraints.audio && !constraints.video) {
    logToScreen("[MEDIA] No media access granted for selected devices. Proceeding without local stream.");
    return false;
}

try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    logToScreen("[MEDIA] Media stream acquired successfully.");
    localAudio.srcObject = localStream;
    localCallMicVisualizer = visualizeLocalMicForCall(localStream, localGlow);

    if (constraints.video && localStream.getVideoTracks().length > 0) {
        originalVideoTrack = localStream.getVideoTracks();
        localVideo.srcObject = localStream;
        await localVideo.play();
        isVideoEnabled = true;
        await enumerateVideoDevices();
    } else {
        isVideoEnabled = false;
        if (constraints.video) {
            logToScreen("[MEDIA] WARNING: Video requested but no video track found.");
            currentCallType = 'audio';
        }
    }
    return true;
} catch (error) {
    logToScreen(`[MEDIA] ERROR getting media: ${error.name} - ${error.message}`);
    return false;
}

}

function setupDataChannelEvents(channel) {
channel.onopen = () => logToScreen('[DC] DataChannel is open.');
channel.onclose = () => logToScreen('[DC] DataChannel is closed.');
channel.onerror = (error) => logToScreen([DC] DataChannel error: ${error});
channel.onmessage = (event) => {
try {
const message = JSON.parse(event.data);
logToScreen([DC] Received message: ${message.type});
if (message.type === 'hangup') {
endCall(false, 'ended_by_peer_dc');
} else if (message.type === 'mute_status') {
handleRemoteMuteStatus(message.muted);
}
} catch (e) {
logToScreen([DC] Received non-JSON message: ${event.data});
}
};
}

function handleRemoteMuteStatus(isMuted) {
let remoteMuteToastTimeout;
clearTimeout(remoteMuteToastTimeout);
const remoteMuteToast = document.getElementById('remote-mute-toast');
if (isMuted) {
remoteMuteToast.textContent = "Собеседник выключил микрофон. 🔇";
remoteMuteToast.classList.add('visible');
remoteMuteToastTimeout = setTimeout(() => {
remoteMuteToast.classList.remove('visible');
}, 3000);
} else {
remoteMuteToast.classList.remove('visible');
}
logToScreen([REMOTE_STATUS] Peer is now ${isMuted ? 'muted' : 'unmuted'}.);
}

async function createPeerConnection() {
logToScreen("[WEBRTC] Creating RTCPeerConnection.");
if (!rtcConfig) {
logToScreen("[CRITICAL] rtcConfig is not available.");
alert("Ошибка конфигурации сети. Пожалуйста, обновите страницу.");
return;
}

code
Code
download
content_copy
expand_less
connectionLogger.reset();
if (isCallInitiator) {
    const probeResults = await probeIceServers();
    connectionLogger.setProbeResults(probeResults);
}

if (peerConnection) peerConnection.close();
peerConnection = new RTCPeerConnection(rtcConfig);
remoteStream = new MediaStream();
remoteVideo.srcObject = remoteStream;
remoteAudio.srcObject = remoteStream;

if (selectedAudioOutId && typeof remoteVideo.setSinkId === 'function') {
    remoteVideo.setSinkId(selectedAudioOutId).catch(e => logToScreen(`[SINK] Error setting sinkId for video: ${e}`));
    remoteAudio.setSinkId(selectedAudioOutId).catch(e => logToScreen(`[SINK] Error setting sinkId for audio: ${e}`));
}

peerConnection.ondatachannel = (event) => {
    logToScreen('[DC] Received remote DataChannel.');
    dataChannel = event.channel;
    setupDataChannelEvents(dataChannel);
};

peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection.iceConnectionState;
    logToScreen(`[WEBRTC] ICE State: ${state}`);
    
    if (state === 'connected') {
        connectionLogger.analyzeAndSend();
        if (iceRestartTimeoutId) {
            clearTimeout(iceRestartTimeoutId);
            iceRestartTimeoutId = null;
            logToScreen('[WEBRTC] Connection recovered before ICE Restart was initiated.');
        }
    } else if (state === 'disconnected') {
        logToScreen('[WEBRTC] Connection is disconnected. Scheduling ICE Restart check.');
        if (iceRestartTimeoutId) clearTimeout(iceRestartTimeoutId);
        iceRestartTimeoutId = setTimeout(() => {
            if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
                logToScreen('[WEBRTC] Connection did not recover. Initiating ICE Restart.');
                initiateIceRestart();
            }
        }, 5000);
    } else if (state === 'failed') {
        logToScreen(`[WEBRTC] P2P connection failed. Ending call.`);
        endCall(false, 'p2p_failed'); 
    }
};

peerConnection.onsignalingstatechange = () => logToScreen(`[WEBRTC] Signaling State: ${peerConnection.signalingState}`);

peerConnection.onicecandidate = event => {
    if (event.candidate) {
       const isRelayCandidate = event.candidate.candidate.includes(" typ relay ");
        
        if (PREVENT_P2P_DOWNGRADE && currentConnectionType === 'p2p' && isRelayCandidate) {
            logToScreen(`[WEBRTC_POLICY] Blocking TURN candidate to prevent downgrade from P2P.`);
            return; 
        }

        sendMessage({ type: 'candidate', data: { target_id: targetUser.id, candidate: event.candidate } });
    }
};

peerConnection.ontrack = event => {
    logToScreen(`[WEBRTC] Received remote track: ${event.track.kind}`);
    remoteStream.addTrack(event.track);
    if (event.track.kind === 'audio') {
        remoteMicVisualizer = visualizeRemoteMic(remoteStream);
    }
};
if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    logToScreen("[WEBRTC] Local tracks added to PeerConnection.");
} else {
    logToScreen("[WEBRTC] No local stream available to add tracks.");
}

}

async function initiateIceRestart() {
if (!peerConnection) return;
logToScreen('[WEBRTC] Creating new offer with iceRestart: true');
try {
const offer = await peerConnection.createOffer({ iceRestart: true });
await peerConnection.setLocalDescription(offer);
sendMessage({ type: 'offer', data: { target_id: targetUser.id, offer: offer } });
} catch (error) {
logToScreen([WEBRTC] ICE Restart failed: ${error});
endCall(false, 'ice_restart_failed');
}
}

async function startPeerConnection(targetId, isCaller) {
logToScreen([WEBRTC] Starting PeerConnection. Is caller: ${isCaller});
ringOutAudio.pause(); ringOutAudio.currentTime = 0;
targetUser.id = targetId;
await createPeerConnection();

code
Code
download
content_copy
expand_less
if (isCaller) {
    logToScreen('[DC] Creating DataChannel.');
    dataChannel = peerConnection.createDataChannel('control');
    setupDataChannelEvents(dataChannel);

    const offerOptions = {
        offerToReceiveAudio: true, 
        offerToReceiveVideo: currentCallType === 'video' 
    };
    logToScreen(`[WEBRTC] Creating Offer with options: ${JSON.stringify(offerOptions)}`);
    const offer = await peerConnection.createOffer(offerOptions);

    await peerConnection.setLocalDescription(offer);
    sendMessage({ type: 'offer', data: { target_id: targetId, offer: offer } });
}

}

async function handleOffer(data) {
logToScreen("[WEBRTC] Received Offer, creating Answer.");
if (!peerConnection) await startPeerConnection(data.from, false);
await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
const answer = await peerConnection.createAnswer();
await peerConnection.setLocalDescription(answer);
sendMessage({ type: 'answer', data: { target_id: data.from, answer: answer } });

code
Code
download
content_copy
expand_less
if (!callScreen.classList.contains('active')) {
    showScreen('call');
    updateCallUI(currentCallType, hasCameraAccess, hasMicrophoneAccess, targetUser);
    callTimerInterval = startTimer();
    connectAudio.play();
}
processIceCandidateQueue();

}

async function handleAnswer(data) {
logToScreen("[WEBRTC] Received Answer.");
if (peerConnection && !peerConnection.currentRemoteDescription) {
await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
callTimerInterval = startTimer();
connectAudio.play();
processIceCandidateQueue();
}
}

async function handleCandidate(data) {
if (data.candidate) {
const candidate = new RTCIceCandidate(data.candidate);
if (peerConnection && peerConnection.remoteDescription) {
await peerConnection.addIceCandidate(candidate);
} else {
iceCandidateQueue.push(candidate);
logToScreen("[WEBRTC] Queued an ICE candidate.");
}
}
}

async function processIceCandidateQueue() {
while (iceCandidateQueue.length > 0) {
const candidate = iceCandidateQueue.shift();
try {
await peerConnection.addIceCandidate(candidate);
logToScreen("[WEBRTC] Added a queued ICE candidate.");
} catch (e) {
logToScreen([WEBRTC] ERROR adding queued ICE candidate: ${e});
}
}
}

function stopIncomingRing() {
ringInAudio.pause();
ringInAudio.currentTime = 0;
}

function toggleMute() {
if (!hasMicrophoneAccess) return;
isMuted = !isMuted;
if (localStream) localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
muteBtn.classList.toggle('active', isMuted);
logToScreen([CONTROLS] Mic ${isMuted ? 'muted' : 'unmuted'}.);
if (dataChannel && dataChannel.readyState === 'open') {
dataChannel.send(JSON.stringify({ type: 'mute_status', muted: isMuted }));
}
}

function toggleSpeaker() {
isSpeakerMuted = !isSpeakerMuted;
if (remoteStream) {
remoteStream.getAudioTracks().forEach(track => {
track.enabled = !isSpeakerMuted;
});
}
speakerBtn.classList.toggle('active', isSpeakerMuted);
logToScreen([CONTROLS] Remote audio (speaker) ${isSpeakerMuted ? 'muted' : 'unmuted'}.);
}

function toggleVideo() {
if (isScreenSharing || !hasCameraAccess) return;
isVideoEnabled = !isVideoEnabled;
if (localStream) localStream.getVideoTracks().forEach(track => track.enabled = isVideoEnabled);
videoBtn.classList.toggle('active', !isVideoEnabled);
localVideoContainer.style.display = isVideoEnabled ? 'flex' : 'none';
logToScreen([CONTROLS] Video ${isVideoEnabled ? 'enabled' : 'disabled'}.);
}

async function openDeviceSettings() {
await populateDeviceSelectorsInCall();
deviceSettingsModal.classList.add('active');
}

async function populateDeviceSelectorsInCall() {
const devices = await navigator.mediaDevices.enumerateDevices();
videoDevices = devices.filter(d => d.kind === 'videoinput');
audioInDevices = devices.filter(d => d.kind === 'audioinput');
audioOutDevices = devices.filter(d => d.kind === 'audiooutput');

code
Code
download
content_copy
expand_less
const populate = (select, devicesList, container, currentId) => {
    if (devicesList.length < 2) {
        container.style.display = 'none';
        return;
    }
    select.innerHTML = '';
    devicesList.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `${select.id} ${select.options.length + 1}`;
        if (device.deviceId === currentId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    container.style.display = 'flex';
};

const currentAudioTrack = localStream?.getAudioTracks();
const currentVideoTrack = localStream?.getVideoTracks();

populate(micSelectCall, audioInDevices, micSelectContainerCall, currentAudioTrack?.getSettings().deviceId);
populate(cameraSelectCall, videoDevices, cameraSelectContainerCall, currentVideoTrack?.getSettings().deviceId);
populate(speakerSelectCall, audioOutDevices, speakerSelectContainerCall, remoteVideo.sinkId);

}

async function switchInputDevice(kind, deviceId) {
if (!localStream || !peerConnection) return;
logToScreen([CONTROLS] Switching ${kind} input to deviceId: ${deviceId});

code
Code
download
content_copy
expand_less
try {
    const currentTrack = kind === 'video' ? localStream.getVideoTracks() : localStream.getAudioTracks();
    if (currentTrack) {
        currentTrack.stop();
    }

    const newStream = await navigator.mediaDevices.getUserMedia({ [kind]: { deviceId: { exact: deviceId } } });
    const newTrack = newStream.getTracks();

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
        selectedVideoId = deviceId;
    } else {
        localCallMicVisualizer = visualizeLocalMicForCall(localStream, localGlow);
        selectedAudioInId = deviceId;
    }
} catch (error) {
    logToScreen(`[CONTROLS] Error switching ${kind} device: ${error}`);
}

}

async function switchAudioOutput(deviceId) {
if (typeof remoteVideo.setSinkId !== 'function') {
logToScreen('[SINK] setSinkId() is not supported by this browser.');
return;
}
try {
await remoteVideo.setSinkId(deviceId);
await remoteAudio.setSinkId(deviceId);
selectedAudioOutId = deviceId;
logToScreen([SINK] Audio output switched to deviceId: ${deviceId});
} catch (error) {
logToScreen([SINK] Error switching audio output: ${error});
}
}

async function enumerateVideoDevices() {
try {
const devices = await navigator.mediaDevices.enumerateDevices();
videoDevices = devices.filter(device => device.kind === 'videoinput');
} catch (error) {
logToScreen([DEVICES] Error enumerating devices: ${error.message});
}
}

async function toggleScreenShare() {
if (!isScreenSharing) {
try {
screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
const screenTrack = screenStream.getVideoTracks();
originalVideoTrack = localStream?.getVideoTracks() || null;
const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
if (sender) await sender.replaceTrack(screenTrack);
screenTrack.onended = () => { if (isScreenSharing) toggleScreenShare(); };
isScreenSharing = true;
updateScreenShareUI(true);
logToScreen("[CONTROLS] Screen sharing started.");
} catch (error) {
logToScreen([CONTROLS] Could not start screen sharing: ${error.message});
}
} else {
if (screenStream) screenStream.getTracks().forEach(track => track.stop());
screenStream = null;
const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
if (sender) {
await sender.replaceTrack(originalVideoTrack);
if (originalVideoTrack) {
originalVideoTrack.enabled = isVideoEnabled;
}
}
isScreenSharing = false;
updateScreenShareUI(false);
logToScreen("[CONTROLS] Screen sharing stopped.");
}
}

function updateScreenShareUI(isSharing) {
const { screenShareBtn } = await import('./call_ui.js');
screenShareBtn.classList.toggle('active', isSharing);
localVideoContainer.style.display = isSharing ? 'none' : (isVideoEnabled && currentCallType === 'video' ? 'flex' : 'none');
}

function resetCallControls() {
isMuted = false; isVideoEnabled = true; isSpeakerMuted = false; isScreenSharing = false;
initialConnectionToastShown = false;
muteBtn.classList.remove('active');
videoBtn.classList.remove('active');
speakerBtn.classList.remove('active');
screenShareBtn.classList.remove('active');
localVideo.classList.remove('force-cover');
remoteVideo.classList.remove('force-cover');

code
Code
download
content_copy
expand_less
const { toggleLocalViewBtn, toggleRemoteViewBtn, audioCallVisualizer } = await import('./call_ui.js');
toggleLocalViewBtn.querySelector('.icon').innerHTML = ICONS.localViewContain;
toggleRemoteViewBtn.querySelector('.icon').innerHTML = ICONS.remoteViewCover;

clearTimeout(uiFadeTimeout);
removeVideoCallUiListeners(handleUiInteraction);
callScreen.classList.remove('ui-faded', 'ui-interactive', 'video-call-active', 'audio-call-active');
audioCallVisualizer.style.display = 'none';
isEndingCall = false;

}

async function updateRoomLifetime() {
try {
const response = await fetch(/room/lifetime/${roomId});
if (!response.ok) throw new Error('Room not found or expired on server.');
const data = await response.json();
const remainingSeconds = data.remaining_seconds;
if (remainingSeconds <= 0) {
lifetimeTimer.textContent = "00:00";
clearInterval(lifetimeTimerInterval);
alert("Время жизни ссылки истекло.");
redirectToInvalidLink();
} else {
const hours = Math.floor(remainingSeconds / 3600);
const minutes = Math.floor((remainingSeconds % 3600) / 60);
lifetimeTimer.textContent = ${String(hours).padStart(2, '0')} ч. ${String(minutes).padStart(2, '0')} м.;
}
} catch (error) {
logToScreen([LIFETIME] Error fetching lifetime: ${error.message});
lifetimeTimer.textContent = "Ошибка";
clearInterval(lifetimeTimerInterval);
}
}

async function closeSession() {
logToScreen("[SESSION] User clicked close session button.");
isGracefulDisconnect = true;
try {
await fetch(/room/close/${roomId}, { method: 'POST' });
} catch (error) {
logToScreen([SESSION] Error sending close request: ${error});
alert("Не удалось закрыть сессию. Попробуйте обновить страницу.");
}
}

function redirectToInvalidLink() {
isGracefulDisconnect = true;
window.location.reload();
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

code
Code
download
content_copy
expand_less
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

            if (!initialConnectionToastShown && peerConnection.iceConnectionState === 'connected') {
                initialConnectionToastShown = true;
                if (connectionTypeForIcon === 'p2p' || connectionTypeForIcon === 'local') {
                    showConnectionToast('good', 'Установлено прямое P2P-соединение. Качество связи будет максимальным.');
                } else if (connectionTypeForIcon === 'relay') {
                    showConnectionToast('bad', 'Прямое соединение не удалось. Звонок идет через сервер, возможны задержки.');
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
        logToScreen(`[STATS] Quality: rtt=${roundTripTime.toFixed(0)}ms, jitter=${jitter.toFixed(2)}ms, loss=${(packetsLostDelta*100).toFixed(2)}% -> ${quality}`);
    }
    updateConnectionQualityIcon(quality);
    lastRtcStats = { remoteInboundRtp };
} catch (error) {
    logToScreen(`Error getting connection stats: ${error}`);
}

}

function handleUiInteraction() {
clearTimeout(uiFadeTimeout);
callScreen.classList.add('ui-interactive');
callScreen.classList.remove('ui-faded');
uiFadeTimeout = setTimeout(() => {
callScreen.classList.add('ui-faded');
callScreen.classList.remove('ui-interactive');
}, 2000);
}

const eventHandlers = {
proceedToCall,
updatePreviewStream,
toggleSpeaker,
toggleMute,
toggleVideo,
toggleScreenShare,
acceptCall,
declineCall,
endCall: () => endCall(true, 'cancelled_by_user'),
closeSession,
openDeviceSettings,
switchInputDevice,
switchAudioOutput,
initiateCall,
handleUiInteraction,
showConnectionInfo: () => showConnectionInfo(currentConnectionDetails)
};