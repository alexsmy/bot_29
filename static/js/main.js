import {
    preCallCheckScreen, previewVideo, micLevelBars, cameraStatus, cameraStatusText,
    micStatus, micStatusText, continueToCallBtn, continueSpectatorBtn, cameraSelect,
    micSelect, speakerSelect, cameraSelectContainer, micSelectContainer, speakerSelectContainer,
    preCallScreen, popupWaiting, popupActions, popupInitiating, lifetimeTimer,
    closeSessionBtn, instructionsBtn, instructionsModal, closeInstructionsBtns, callScreen,
    audioCallVisualizer, localGlow, remoteGlow, incomingCallModal, callerName,
    incomingCallType, acceptBtn, declineBtn, hangupBtn, remoteUserName, callTimer,
    speakerBtn, muteBtn, videoBtn, videoControlItem, switchCameraBtn, switchCameraControlItem,
    screenShareBtn, screenShareControlItem, localAudio, remoteAudio, localVideo, remoteVideo,
    localVideoContainer, toggleLocalViewBtn, toggleRemoteViewBtn, ringOutAudio, connectAudio,
    ringInAudio, connectionStatus, connectionQuality, qualityGoodSvg, qualityMediumSvg,
    qualityBadSvg, remoteAudioLevel, remoteAudioLevelBars, connectionInfoPopup,
    remoteMuteToast, connectionToast, deviceSettingsBtn, deviceSettingsModal,
    closeSettingsBtns, cameraSelectCall, micSelectCall, speakerSelectCall,
    cameraSelectContainerCall, micSelectContainerCall, speakerSelectContainerCall
} from './call_ui_elements.js';

import { initializeWebSocket, sendMessage, setGracefulDisconnect } from './call_websocket.js';
import * as webrtc from './call_webrtc.js';

const tg = window.Telegram.WebApp;

let localStream;
let previewStream;
let micVisualizer;
let localCallMicVisualizer;
let remoteMicVisualizer;
let localAudioContext;
let remoteAudioContext;
let currentUser = {};
let targetUser = {};
let currentCallType = 'audio';
let callTimerInterval;
let lifetimeTimerInterval;
let uiFadeTimeout = null;
let isSpeakerMuted = false;
let isMuted = false;
let isVideoEnabled = true;
let hasMicrophoneAccess = false;
let hasCameraAccess = false;
let isSpectator = false;
let roomId = '';
let rtcConfig = null;
let connectionStatsInterval = null;
let lastRtcStats = null;
let videoDevices = [];
let audioInDevices = [];
let audioOutDevices = [];
let selectedVideoId = null;
let selectedAudioInId = null;
let selectedAudioOutId = null;
let iceServerDetails = {};
let currentConnectionDetails = null;
let infoPopupTimeout = null;
let isCallInitiator = false;
let isEndingCall = false;
let remoteMuteToastTimeout = null;
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
        if (this.isDataSent) return;
        const peerConnection = webrtc.getPeerConnection();
        if (!peerConnection) return;

        if (!this.data.isCallInitiator) {
            logToScreen('[LOGGER] Not the call initiator, skipping log submission.');
            return;
        }
        this.isDataSent = true;

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
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const logMessage = `[${time}] ${message}`;
    console.log(logMessage);
    sendLogToServer(logMessage);
}

function loadIcons() {
    const iconPlaceholders = document.querySelectorAll('[data-icon-name]');
    if (typeof ICONS === 'undefined') {
        console.error('icons.js is not loaded or ICONS object is not defined.');
        return;
    }
    iconPlaceholders.forEach(placeholder => {
        const iconName = placeholder.dataset.iconName;
        if (ICONS[iconName]) {
            placeholder.innerHTML = ICONS[iconName];
        } else {
            console.warn(`Icon with name "${iconName}" not found.`);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    loadIcons();
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
        roomId = parts[2];
        initializePrivateCallMode();
    } else {
        document.body.innerHTML = "<h1>Неверный URL</h1>";
    }
});

function initializePrivateCallMode() {
    logToScreen(`Initializing in Private Call mode for room: ${roomId}`);
    
    const webrtcCallbacks = {
        log: logToScreen,
        onCallConnected: () => {
            if (!callScreen.classList.contains('active')) {
                showScreen('call');
                updateCallUI();
            }
            startTimer();
            connectAudio.play();
        },
        onCallEndedByPeer: (reason) => endCall(false, reason),
        onRemoteTrack: (stream) => visualizeRemoteMic(stream),
        onRemoteMuteStatus: handleRemoteMuteStatus,
        getTargetUser: () => targetUser,
        getSelectedAudioOutId: () => selectedAudioOutId,
        getCurrentConnectionType: () => currentConnectionType,
        isVideoEnabled: () => isVideoEnabled,
    };
    webrtc.init(webrtcCallbacks);

    setupEventListeners();
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
        logToScreen(`[MEDIA_CHECK] Combined media request failed: ${error.name}. Trying separately.`);
        const results = await Promise.allSettled([
            navigator.mediaDevices.getUserMedia({ video: true }),
            navigator.mediaDevices.getUserMedia({ audio: true })
        ]);
        const videoResult = results[0];
        const audioResult = results[1];

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

    updateStatusIndicators();

    if (stream) {
        previewStream = stream;
        previewVideo.srcObject = stream;
        if (hasMicrophoneAccess) visualizeMic(stream);
        await populateDeviceSelectors();
        continueToCallBtn.disabled = false;
    } else {
        logToScreen('[MEDIA_CHECK] No media devices available or access denied to all.');
    }
}

function updateStatusIndicators() {
    cameraStatus.classList.toggle('status-ok', hasCameraAccess);
    cameraStatus.classList.toggle('status-error', !hasCameraAccess);
    cameraStatusText.textContent = `Камера: ${hasCameraAccess ? 'OK' : 'Нет доступа'}`;

    micStatus.classList.toggle('status-ok', hasMicrophoneAccess);
    micStatus.classList.toggle('status-error', !hasMicrophoneAccess);
    micStatusText.textContent = `Микрофон: ${hasMicrophoneAccess ? 'OK' : 'Нет доступа'}`;
}

function displayMediaErrors(error) {
    let message = 'Не удалось получить доступ к камере и/или микрофону. ';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message += 'Вы заблокировали доступ. Пожалуйста, измените разрешения в настройках браузера.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        message += 'Устройства не найдены. Убедитесь, что они подключены и работают.';
    } else {
        message += 'Произошла ошибка. Попробуйте перезагрузить страницу.';
    }
}

async function populateDeviceSelectors() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(d => d.kind === 'videoinput');
    audioInDevices = devices.filter(d => d.kind === 'audioinput');
    audioOutDevices = devices.filter(d => d.kind === 'audiooutput');

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
    if (micVisualizer) cancelAnimationFrame(micVisualizer);

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
        if (hasMicrophoneAccess) visualizeMic(previewStream);
    } catch (error) {
        logToScreen(`[MEDIA_UPDATE] Error updating preview stream: ${error}`);
    }
}

function visualizeMic(stream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);

    function draw() {
        micVisualizer = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const volume = Math.min(Math.floor(average / 15), micLevelBars.length);

        micLevelBars.forEach((bar, index) => {
            bar.classList.toggle('active', index < volume);
        });
    }
    draw();
}

function visualizeLocalMicForCall(stream) {
    if (localCallMicVisualizer) cancelAnimationFrame(localCallMicVisualizer);
    if (localAudioContext) localAudioContext.close();
    if (!stream || stream.getAudioTracks().length === 0) return;

    localAudioContext = new AudioContext();
    const source = localAudioContext.createMediaStreamSource(stream);
    const analyser = localAudioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);

    function draw() {
        localCallMicVisualizer = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const intensity = Math.min(average / 100, 1.0);
        localGlow.style.setProperty('--glow-intensity', intensity);
    }
    draw();
}

function visualizeRemoteMic(stream) {
    if (remoteMicVisualizer) cancelAnimationFrame(remoteMicVisualizer);
    if (remoteAudioContext) remoteAudioContext.close();

    if (!stream || stream.getAudioTracks().length === 0) {
        logToScreen("[REMOTE_MIC] No audio track found in remote stream to visualize.");
        remoteAudioLevel.style.display = 'none';
        return;
    }

    remoteAudioLevel.style.display = 'flex';
    remoteAudioContext = new AudioContext();
    const source = remoteAudioContext.createMediaStreamSource(stream);
    const analyser = remoteAudioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);
    analyser.connect(remoteAudioContext.destination);

    function draw() {
        remoteMicVisualizer = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        
        const intensity = Math.min(average / 100, 1.0);
        remoteGlow.style.setProperty('--glow-intensity', intensity);

        const maxVolume = 160;
        const percentage = Math.min((average / maxVolume) * 100, 100);
        let level = 0;
        if (percentage > 90) level = 5;
        else if (percentage > 70) level = 4;
        else if (percentage > 35) level = 3;
        else if (percentage > 10) level = 2;
        else if (average > 1) level = 1;
        remoteAudioLevelBars.forEach((bar, index) => bar.classList.toggle('active', index < level));
    }
    draw();
}

function proceedToCall(asSpectator = false) {
    isSpectator = asSpectator;
    logToScreen(`Proceeding to call screen. Spectator mode: ${isSpectator}`);
    if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
    }
    if (micVisualizer) cancelAnimationFrame(micVisualizer);

    showScreen('pre-call');
    showPopup('waiting');
    
    const wsHandlers = {
        onIdentity: (data) => {
            currentUser.id = data.id;
            logToScreen(`[WS] Identity assigned by server: ${currentUser.id}`);
        },
        onUserList: handleUserList,
        onIncomingCall: handleIncomingCall,
        onCallAccepted: () => {
            ringOutAudio.pause(); 
            ringOutAudio.currentTime = 0;
            webrtc.startPeerConnection(targetUser.id, true, currentCallType, localStream, rtcConfig, connectionLogger);
        },
        onOffer: (data) => webrtc.handleOffer(data, localStream, rtcConfig, connectionLogger),
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
    initializeWebSocket(roomId, wsHandlers, logToScreen);

    updateRoomLifetime();
    lifetimeTimerInterval = setInterval(updateRoomLifetime, 60000);
}

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (screenName) document.getElementById(`${screenName}-screen`).classList.add('active');
}

function showModal(modalName, show) {
    const modal = document.getElementById(`${modalName}-modal`);
    if (modal) modal.classList.toggle('active', show);
}

function showPopup(popupName) {
    document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
    if (popupName) document.getElementById(`popup-${popupName}`).classList.add('active');
}

function resetUiFade() {
    callScreen.classList.add('ui-interactive');
    callScreen.classList.remove('ui-faded');
    clearTimeout(uiFadeTimeout);
    uiFadeTimeout = setTimeout(() => callScreen.classList.add('ui-faded'), 2000);
    setTimeout(() => callScreen.classList.remove('ui-interactive'), 150);
}

function setupVideoCallUiListeners() {
    callScreen.addEventListener('mousemove', resetUiFade);
    callScreen.addEventListener('click', resetUiFade);
    callScreen.addEventListener('touchstart', resetUiFade);
}

function removeVideoCallUiListeners() {
    callScreen.removeEventListener('mousemove', resetUiFade);
    callScreen.removeEventListener('click', resetUiFade);
    callScreen.removeEventListener('touchstart', resetUiFade);
}

function handleUserList(users) {
    const otherUsers = users.filter(u => u.id !== currentUser.id);

    if (otherUsers.length === 0) {
        targetUser = {};
        showPopup('waiting');
    } else {
        targetUser = otherUsers[0];
        if (targetUser.status === 'busy') {
            showPopup('initiating');
        } else {
            showPopup('actions');
        }
    }
}

async function initiateCall(userToCall, callType) {
    logToScreen(`[CALL] Initiating call to user ${userToCall.id}, type: ${callType}`);
    isCallInitiator = true;
    currentCallType = callType;
    
    if (currentCallType === 'video') {
        remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType === 'video');
    if (!hasMedia) logToScreen("[CALL] Proceeding with call without local media.");

    targetUser = userToCall;
    sendMessage({ type: 'call_user', data: { target_id: targetUser.id, call_type: currentCallType } });

    showScreen('call');
    updateCallUI();
    callTimer.textContent = "Вызов...";
    ringOutAudio.play();
}

function handleIncomingCall(data) {
    logToScreen(`[CALL] Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    isCallInitiator = false;
    targetUser = data.from_user;
    currentCallType = data.call_type;

    callerName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    incomingCallType.textContent = currentCallType === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок';
    showModal('incoming-call', true);
    ringInAudio.play();
}

async function acceptCall() {
    logToScreen("[CALL] 'Accept' button pressed.");
    stopIncomingRing();
    showModal('incoming-call', false);

    if (currentCallType === 'video') {
        remoteVideo.play().catch(() => {});
    }

    const hasMedia = await initializeLocalMedia(currentCallType === 'video');
    if (!hasMedia) logToScreen("[CALL] No local media available, accepting as receive-only.");

    logToScreen("[CALL] Starting WebRTC connection.");
    await webrtc.startPeerConnection(targetUser.id, false, currentCallType, localStream, rtcConfig, connectionLogger);
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

    logToScreen(`[CALL] Ending call. Initiator: ${isInitiator}, Reason: ${reason}`);
    setGracefulDisconnect(true);

    currentConnectionType = 'unknown';

    if (isInitiator && targetUser.id) {
        sendMessage({ type: 'hangup', data: { target_id: targetUser.id } });
    }

    if (isInitiator && !connectionLogger.isDataSent) {
        connectionLogger.sendProbeLog();
    }

    if (connectionStatsInterval) clearInterval(connectionStatsInterval);
    lastRtcStats = null;
    currentConnectionDetails = null;

    webrtc.endPeerConnection();

    if (localCallMicVisualizer) cancelAnimationFrame(localCallMicVisualizer);
    if (remoteMicVisualizer) cancelAnimationFrame(remoteMicVisualizer);
    if (localAudioContext) localAudioContext.close();
    if (remoteAudioContext) remoteAudioContext.close();
    localCallMicVisualizer = null;
    remoteMicVisualizer = null;
    localAudioContext = null;
    remoteAudioContext = null;
    if (remoteAudioLevel) remoteAudioLevel.style.display = 'none';

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    ringOutAudio.pause(); ringOutAudio.currentTime = 0;
    stopIncomingRing();

    localAudio.srcObject = null;
    localVideo.srcObject = null;
    localVideoContainer.style.display = 'none';
    remoteVideo.style.display = 'none';
    
    connectionQuality.classList.remove('active');
    updateConnectionQualityIcon('unknown');
    updateConnectionIcon('unknown');

    stopTimer();
    showModal('incoming-call', false);
    showScreen('pre-call');

    targetUser = {};
    resetCallControls();
}

function setupEventListeners() {
    continueToCallBtn.addEventListener('click', () => proceedToCall(false));
    continueSpectatorBtn.addEventListener('click', () => proceedToCall(true));
    cameraSelect.addEventListener('change', updatePreviewStream);
    micSelect.addEventListener('change', updatePreviewStream);
    speakerSelect.addEventListener('change', updatePreviewStream);

    speakerBtn.addEventListener('click', toggleSpeaker);
    muteBtn.addEventListener('click', toggleMute);
    videoBtn.addEventListener('click', toggleVideo);
    screenShareBtn.addEventListener('click', () => webrtc.toggleScreenShare(localStream, updateScreenShareUI));
    acceptBtn.addEventListener('click', acceptCall);
    declineBtn.addEventListener('click', declineCall);
    
    hangupBtn.addEventListener('click', () => endCall(true, 'cancelled_by_user'));
    
    closeSessionBtn.addEventListener('click', closeSession);

    instructionsBtn.addEventListener('click', () => instructionsModal.classList.add('active'));
    closeInstructionsBtns.forEach(btn => btn.addEventListener('click', () => instructionsModal.classList.remove('active')));

    deviceSettingsBtn.addEventListener('click', openDeviceSettings);
    closeSettingsBtns.forEach(btn => btn.addEventListener('click', () => deviceSettingsModal.classList.remove('active')));
    cameraSelectCall.addEventListener('change', (e) => switchInputDevice('video', e.target.value));
    micSelectCall.addEventListener('change', (e) => switchInputDevice('audio', e.target.value));
    speakerSelectCall.addEventListener('change', (e) => switchAudioOutput(e.target.value));

    popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        if (button && targetUser.id) {
            initiateCall(targetUser, button.dataset.callType);
        }
    });

    toggleLocalViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        localVideo.classList.toggle('force-cover');
        const iconSpan = toggleLocalViewBtn.querySelector('.icon');
        iconSpan.innerHTML = localVideo.classList.contains('force-cover') ? ICONS.localViewCover : ICONS.localViewContain;
    });

    toggleRemoteViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        remoteVideo.classList.toggle('force-cover');
        const iconSpan = toggleRemoteViewBtn.querySelector('.icon');
        iconSpan.innerHTML = remoteVideo.classList.contains('force-cover') ? ICONS.remoteViewContain : ICONS.remoteViewCover;
    });

    connectionStatus.addEventListener('click', showConnectionInfo);

    setupLocalVideoInteraction();
}

function setupLocalVideoInteraction() {
    let isDragging = false, hasMoved = false, dragStartX, offsetX, longPressTimer;

    const onDragStart = (e) => {
        if (e.type === 'touchstart' && e.touches.length > 1) return;
        hasMoved = false;
        const rect = localVideoContainer.getBoundingClientRect();
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        dragStartX = clientX;
        offsetX = clientX - rect.left;
        longPressTimer = setTimeout(() => {
            isDragging = true;
            localVideoContainer.classList.add('dragging');
        }, 200);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchend', onDragEnd);
    };

    const onDragMove = (e) => {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        if (!hasMoved && Math.abs(clientX - dragStartX) > 5) {
            hasMoved = true;
            clearTimeout(longPressTimer);
            if (!isDragging) {
                isDragging = true;
                localVideoContainer.classList.add('dragging');
            }
        }
        if (isDragging) {
            if (e.type === 'touchmove') e.preventDefault();
            let newLeft = clientX - offsetX;
            const parentWidth = localVideoContainer.parentElement.clientWidth;
            const videoWidth = localVideoContainer.getBoundingClientRect().width;
            newLeft = Math.max(0, Math.min(newLeft, parentWidth - videoWidth));
            localVideoContainer.style.left = `${newLeft}px`;
        }
    };

    const onDragEnd = (e) => {
        clearTimeout(longPressTimer);
        if (!hasMoved && !e.target.closest('button')) {
            localVideoContainer.classList.toggle('small');
        }
        isDragging = false;
        localVideoContainer.classList.remove('dragging');
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);
    };

    localVideoContainer.addEventListener('mousedown', onDragStart);
    localVideoContainer.addEventListener('touchstart', onDragStart, { passive: true });
}

async function initializeLocalMedia(isVideo) {
    if (isSpectator) {
        logToScreen("[MEDIA] Spectator mode, skipping media initialization.");
        return false;
    }
    logToScreen(`[MEDIA] Requesting media. Video requested: ${isVideo}`);
    if (localStream) localStream.getTracks().forEach(track => track.stop());

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
        visualizeLocalMicForCall(localStream);

        if (constraints.video && localStream.getVideoTracks().length > 0) {
            localVideo.srcObject = localStream;
            await localVideo.play();
            localVideoContainer.style.display = 'flex';
            isVideoEnabled = true;
            await enumerateVideoDevices();
        } else {
            localVideoContainer.style.display = 'none';
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

function handleRemoteMuteStatus(isMuted) {
    clearTimeout(remoteMuteToastTimeout);
    if (isMuted) {
        remoteMuteToast.textContent = "Собеседник выключил микрофон. 🔇";
        remoteMuteToast.classList.add('visible');
        remoteMuteToastTimeout = setTimeout(() => {
            remoteMuteToast.classList.remove('visible');
        }, 3000);
    } else {
        remoteMuteToast.classList.remove('visible');
    }
    logToScreen(`[REMOTE_STATUS] Peer is now ${isMuted ? 'muted' : 'unmuted'}.`);
}

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function stopIncomingRing() {
    ringInAudio.pause();
    ringInAudio.currentTime = 0;
}

function updateCallUI() {
    remoteUserName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    const isVideoCall = currentCallType === 'video';
    videoControlItem.style.display = isVideoCall && hasCameraAccess ? 'flex' : 'none';
    muteBtn.parentElement.style.display = hasMicrophoneAccess ? 'flex' : 'none';
    screenShareControlItem.style.display = isVideoCall && !isMobileDevice() ? 'flex' : 'none';
    remoteVideo.style.display = isVideoCall ? 'block' : 'none';
    
    callScreen.classList.toggle('video-call-active', isVideoCall);
    callScreen.classList.toggle('audio-call-active', !isVideoCall);
}

function toggleMute() {
    if (!hasMicrophoneAccess) return;
    isMuted = !isMuted;
    webrtc.toggleMute(isMuted, localStream);
    muteBtn.classList.toggle('active', isMuted);
    logToScreen(`[CONTROLS] Mic ${isMuted ? 'muted' : 'unmuted'}.`);
}

function toggleSpeaker() {
    isSpeakerMuted = !isSpeakerMuted;
    remoteAudio.muted = isSpeakerMuted;
    speakerBtn.classList.toggle('active', isSpeakerMuted);
    logToScreen(`[CONTROLS] Remote audio (speaker) ${isSpeakerMuted ? 'muted' : 'unmuted'}.`);
}

function toggleVideo() {
    if (!hasCameraAccess) return;
    isVideoEnabled = !isVideoEnabled;
    webrtc.toggleVideo(isVideoEnabled, localStream);
    videoBtn.classList.toggle('active', !isVideoEnabled);
    localVideoContainer.style.display = isVideoEnabled ? 'flex' : 'none';
    logToScreen(`[CONTROLS] Video ${isVideoEnabled ? 'enabled' : 'disabled'}.`);
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

    const currentAudioTrack = localStream?.getAudioTracks()[0];
    const currentVideoTrack = localStream?.getVideoTracks()[0];
    
    populate(micSelectCall, audioInDevices, micSelectContainerCall, currentAudioTrack?.getSettings().deviceId);
    populate(cameraSelectCall, videoDevices, cameraSelectContainerCall, currentVideoTrack?.getSettings().deviceId);
    populate(speakerSelectCall, audioOutDevices, speakerSelectContainerCall, remoteVideo.sinkId);
}

async function switchInputDevice(kind, deviceId) {
    const newTrack = await webrtc.switchInputDevice(kind, deviceId, localStream);
    if (newTrack) {
        if (kind === 'video') {
            selectedVideoId = deviceId;
        } else {
            visualizeLocalMicForCall(localStream);
            selectedAudioInId = deviceId;
        }
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
        logToScreen(`[SINK] Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        logToScreen(`[SINK] Error switching audio output: ${error}`);
    }
}

async function enumerateVideoDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
        logToScreen(`[DEVICES] Error enumerating devices: ${error.message}`);
    }
}

function updateScreenShareUI(isSharing) {
    screenShareBtn.classList.toggle('active', isSharing);
    localVideoContainer.style.display = isSharing ? 'none' : (isVideoEnabled && currentCallType === 'video' ? 'flex' : 'none');
}

function resetCallControls() {
    isMuted = false; isVideoEnabled = true; isSpeakerMuted = false;
    initialConnectionToastShown = false;
    muteBtn.classList.remove('active');
    videoBtn.classList.remove('active');
    speakerBtn.classList.remove('active');
    screenShareBtn.classList.remove('active');
    localVideo.classList.remove('force-cover');
    remoteVideo.classList.remove('force-cover');
    toggleLocalViewBtn.querySelector('.icon').innerHTML = ICONS.localViewContain;
    toggleRemoteViewBtn.querySelector('.icon').innerHTML = ICONS.remoteViewCover;
    clearTimeout(uiFadeTimeout);
    removeVideoCallUiListeners();
    callScreen.classList.remove('ui-faded', 'ui-interactive', 'video-call-active', 'audio-call-active');
    audioCallVisualizer.style.display = 'none';
    remoteUserName.style.display = 'block';
    isEndingCall = false;
}

function startTimer() {
    callScreen.classList.add('call-connected');
    if (callTimerInterval) clearInterval(callTimerInterval);
    let seconds = 0;
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'none';
    callTimerInterval = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        callTimer.textContent = `${mins}:${secs}`;
    }, 1000);

    if (currentCallType === 'video') {
        setupVideoCallUiListeners();
        resetUiFade();
    } else {
        audioCallVisualizer.style.display = 'flex';
    }

    if (connectionStatsInterval) clearInterval(connectionStatsInterval);
    connectionStatsInterval = setInterval(monitorConnectionStats, 3000);
    updateConnectionIcon('unknown');
    updateConnectionQualityIcon('unknown');
    connectionQuality.classList.add('active');
}

function stopTimer() {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'block';
}

async function updateRoomLifetime() {
    try {
        const response = await fetch(`/room/lifetime/${roomId}`);
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
            lifetimeTimer.textContent = `${String(hours).padStart(2, '0')} ч. ${String(minutes).padStart(2, '0')} м.`;
        }
    } catch (error) {
        logToScreen(`[LIFETIME] Error fetching lifetime: ${error.message}`);
        lifetimeTimer.textContent = "Ошибка";
        clearInterval(lifetimeTimerInterval);
    }
}

async function closeSession() {
    logToScreen("[SESSION] User clicked close session button.");
    setGracefulDisconnect(true);
    try {
        await fetch(`/room/close/${roomId}`, { method: 'POST' });
    } catch (error) {
        logToScreen(`[SESSION] Error sending close request: ${error}`);
        alert("Не удалось закрыть сессию. Попробуйте обновить страницу.");
    }
}

function redirectToInvalidLink() {
    setGracefulDisconnect(true);
    window.location.reload();
}

function updateConnectionIcon(type) {
    connectionStatus.querySelectorAll('.icon:not(#connection-quality)').forEach(icon => icon.classList.remove('active'));
    const typeMap = {
        local: { id: 'conn-local', title: 'Прямое локальное соединение (LAN)' },
        p2p: { id: 'conn-p2p', title: 'Прямое P2P соединение (Direct)' },
        relay: { id: 'conn-relay', title: 'Соединение через сервер (Relay)' },
        unknown: { id: 'conn-unknown', title: 'Определение типа соединения...' }
    };
    const { id, title } = typeMap[type] || typeMap.unknown;
    document.getElementById(id)?.classList.add('active');
    connectionStatus.setAttribute('data-type-title', title);
    const qualityText = connectionStatus.title.split(' / ')[0] || 'Качество соединения';
    connectionStatus.title = `${qualityText} / ${title}`;
}

function updateConnectionQualityIcon(quality) {
    connectionQuality.classList.remove('quality-good', 'quality-medium', 'quality-bad');
    [qualityGoodSvg, qualityMediumSvg, qualityBadSvg].forEach(svg => {
        svg.classList.remove('active-quality-svg');
        svg.style.display = 'none';
    });
    const qualityMap = {
        good: { class: 'quality-good', text: 'Отличное соединение', svg: qualityGoodSvg },
        medium: { class: 'quality-medium', text: 'Среднее соединение', svg: qualityMediumSvg },
        bad: { class: 'quality-bad', text: 'Плохое соединение', svg: qualityBadSvg },
        unknown: { class: '', text: 'Оценка качества...', svg: null }
    };
    const { class: qualityClass, text: qualityText, svg: activeSvg } = qualityMap[quality] || qualityMap.unknown;
    if (qualityClass) connectionQuality.classList.add(qualityClass);
    if (activeSvg) {
        activeSvg.style.display = 'block';
        activeSvg.classList.add('active-quality-svg');
    }
    const typeTitle = connectionStatus.getAttribute('data-type-title') || 'Определение типа...';
    connectionStatus.title = `${qualityText} / ${typeTitle}`;
}

function showConnectionInfo() {
    if (!currentConnectionDetails) return;
    clearTimeout(infoPopupTimeout);
    connectionInfoPopup.textContent = `${currentConnectionDetails.region}, ${currentConnectionDetails.provider}`;
    connectionInfoPopup.classList.add('active');
    infoPopupTimeout = setTimeout(() => {
        connectionInfoPopup.classList.remove('active');
    }, 3000);
}

function showConnectionToast(type, message) {
    connectionToast.textContent = message;
    connectionToast.classList.remove('toast-good', 'toast-bad');
    connectionToast.classList.add(`toast-${type}`);
    connectionToast.classList.add('visible');
    setTimeout(() => {
        connectionToast.classList.remove('visible');
    }, 7000);
}

async function monitorConnectionStats() {
    const peerConnection = webrtc.getPeerConnection();
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