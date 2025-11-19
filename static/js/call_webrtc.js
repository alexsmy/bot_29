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

// --- НОВАЯ ФУНКЦИЯ: Модификация SDP для управления битрейтом и каналами ---
function setAudioPreferences(sdp) {
    try {
        // Ищем Opus кодек. Обычно он выглядит как "a=rtpmap:111 opus/48000/2"
        // Важно: 48000/2 в rtpmap - это clock rate, его менять нельзя.
        // Мы меняем параметры передачи в a=fmtp
        const audioCodecs = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
        if (!audioCodecs) {
            callbacks.log('WEBRTC_SIGNALS', 'Opus codec not found in SDP, skipping modification.');
            return sdp;
        }

        const opusPt = audioCodecs[1];
        
        // Параметры для 16kHz Mono и низкого битрейта
        // maxplaybackrate=16000: Максимальная частота воспроизведения
        // sprop-maxcapturerate=16000: Подсказка удаленной стороне захватывать 16кГц
        // stereo=0: Моно
        // sprop-stereo=0: Подсказка удаленной стороне слать моно
        // maxaveragebitrate=20000: Ограничение битрейта (20 кбит/с достаточно для речи 16кГц)
        const newParams = 'minptime=10;useinbandfec=1;maxplaybackrate=16000;sprop-maxcapturerate=16000;stereo=0;sprop-stereo=0;maxaveragebitrate=20000';
        
        // Ищем существующую строку fmtp для Opus
        const fmtpLineRegex = new RegExp(`a=fmtp:${opusPt} (.*)`, 'i');
        
        if (fmtpLineRegex.test(sdp)) {
            // Если строка есть, заменяем её параметры на наши
            return sdp.replace(fmtpLineRegex, `a=fmtp:${opusPt} ${newParams}`);
        } else {
            // Если строки нет, добавляем её после rtpmap
            return sdp.replace(audioCodecs[0], `${audioCodecs[0]}\r\na=fmtp:${opusPt} ${newParams}`);
        }
    } catch (e) {
        callbacks.log('ERROR', `Failed to modify SDP audio preferences: ${e}`);
        return sdp; // В случае ошибки возвращаем оригинальный SDP (безопасный откат)
    }
}

// --- НОВАЯ ФУНКЦИЯ: Логирование итоговых параметров аудио ---
async function logAudioStats() {
    if (!peerConnection) return;
    
    // Даем время на стабилизацию соединения
    setTimeout(async () => {
        try {
            // Анализируем LocalDescription (что мы обещали отправлять/принимать)
            const localSdp = peerConnection.currentLocalDescription?.sdp;
            if (localSdp) {
                const opusMatch = localSdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
                if (opusMatch) {
                    const pt = opusMatch[1];
                    const fmtp = localSdp.match(new RegExp(`a=fmtp:${pt} (.*)`, 'i'));
                    const params = fmtp ? fmtp[1] : 'default';
                    callbacks.log('MANDATORY', `[AUDIO_CONFIG] Negotiated Local SDP Params: ${params}`);
                }
            }

            // Пытаемся получить реальную статистику из getStats (если браузер поддерживает)
            const stats = await peerConnection.getStats();
            let audioStatsLog = [];
            
            stats.forEach(report => {
                if (report.type === 'outbound-rtp' && report.kind === 'audio') {
                    // Chrome/Safari могут не показывать bitrate в stats сразу, но показывают codec
                    audioStatsLog.push(`Outbound Audio: bytesSent=${report.bytesSent}`);
                }
                if (report.type === 'codec' && report.mimeType === 'audio/opus') {
                    audioStatsLog.push(`Codec: ${report.mimeType}, ClockRate: ${report.clockRate}, Channels: ${report.channels}`);
                }
            });
            
            if (audioStatsLog.length > 0) {
                callbacks.log('MANDATORY', `[AUDIO_STATS] ${audioStatsLog.join(' | ')}`);
            }

        } catch (e) {
            callbacks.log('ERROR', `Error logging audio stats: ${e}`);
        }
    }, 2000);
}

function setupDataChannelEvents(channel) {
    channel.onopen = () => callbacks.log('WEBSOCKET_MESSAGES', 'DataChannel is open.');
    channel.onclose = () => callbacks.log('WEBSOCKET_MESSAGES', 'DataChannel is closed.');
    channel.onerror = (error) => callbacks.log('CRITICAL_ERROR', `DataChannel error: ${error}`);
    channel.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            callbacks.log('WEBSOCKET_MESSAGES', `Received DC message: ${message.type}`);
            if (message.type === 'hangup') {
                callbacks.onCallEndedByPeer('ended_by_peer_dc');
            } else if (message.type === 'mute_status') {
                callbacks.onRemoteMuteStatus(message.muted);
            }
        } catch (e) {
            callbacks.log('WEBSOCKET_MESSAGES', `Received non-JSON DC message: ${event.data}`);
        }
    };
}

async function initiateIceRestart() {
    if (!peerConnection) return;
    callbacks.log('WEBRTC_LIFECYCLE', 'Creating new offer with iceRestart: true');
    try {
        const offer = await peerConnection.createOffer({ iceRestart: true });
        // При рестарте ICE тоже применяем настройки аудио
        const modifiedOfferSdp = setAudioPreferences(offer.sdp);
        const modifiedOffer = { type: offer.type, sdp: modifiedOfferSdp };
        
        await peerConnection.setLocalDescription(modifiedOffer);
        sendMessage({ type: 'offer', data: { target_id: callbacks.getTargetUser().id, offer: modifiedOffer } });
    } catch (error) {
        callbacks.log('CRITICAL_ERROR', `ICE Restart failed: ${error}`);
        callbacks.onCallEndedByPeer('ice_restart_failed');
    }
}

export async function createPeerConnection(rtcConfig, localStream, selectedAudioOutId) {
    callbacks.log("WEBRTC_LIFECYCLE", "Creating RTCPeerConnection.");
    if (!rtcConfig) {
        callbacks.log("CRITICAL_ERROR", "rtcConfig is not available.");
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
        callbacks.log('SINK_ID', `Applying initial sinkId: ${selectedAudioOutId}`);
        remoteVideo.setSinkId(selectedAudioOutId).catch(e => callbacks.log('SINK_ID', `Error setting sinkId for video: ${e}`));
        remoteAudio.setSinkId(selectedAudioOutId).catch(e => callbacks.log('SINK_ID', `Error setting sinkId for audio: ${e}`));
    }

    peerConnection.ondatachannel = (event) => {
        callbacks.log('WEBSOCKET_MESSAGES', 'Received remote DataChannel.');
        dataChannel = event.channel;
        setupDataChannelEvents(dataChannel);
    };

    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        callbacks.log('WEBRTC_ICE_STATE', `ICE State: ${state}`);
        
        if (state === 'connected') {
            if (iceRestartTimeoutId) {
                clearTimeout(iceRestartTimeoutId);
                iceRestartTimeoutId = null;
                callbacks.log('WEBRTC_LIFECYCLE', 'Connection recovered before ICE Restart was initiated.');
            }
            // Запускаем логирование параметров аудио при успешном соединении
            logAudioStats();
        } else if (state === 'disconnected') {
            callbacks.log('WEBRTC_LIFECYCLE', 'Connection is disconnected. Scheduling ICE Restart check.');
            if (iceRestartTimeoutId) clearTimeout(iceRestartTimeoutId);
            iceRestartTimeoutId = setTimeout(() => {
                if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
                    callbacks.log('WEBRTC_LIFECYCLE', 'Connection did not recover. Initiating ICE Restart.');
                    initiateIceRestart();
                }
            }, 5000);
        } else if (state === 'failed') {
            callbacks.log('CRITICAL_ERROR', `P2P connection failed. Ending call.`);
            callbacks.onCallEndedByPeer('p2p_failed'); 
        }
    };

    peerConnection.onsignalingstatechange = () => callbacks.log('WEBRTC_LIFECYCLE', `Signaling State: ${peerConnection.signalingState}`);
    
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
           const isRelayCandidate = event.candidate.candidate.includes(" typ relay ");
            
            if (PREVENT_P2P_DOWNGRADE && callbacks.getCurrentConnectionType() === 'p2p' && isRelayCandidate) {
                callbacks.log('WEBRTC_SIGNALS', `Blocking TURN candidate to prevent downgrade from P2P.`);
                return; 
            }

            sendMessage({ type: 'candidate', data: { target_id: callbacks.getTargetUser().id, candidate: event.candidate } });
        }
    };

    peerConnection.ontrack = event => {
        callbacks.log('WEBRTC_LIFECYCLE', `Received remote track: ${event.track.kind}`);
        remoteStream.addTrack(event.track);
        callbacks.onRemoteTrack(remoteStream);
    };

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        callbacks.log("WEBRTC_LIFECYCLE", "Local tracks added to PeerConnection.");
    } else {
        callbacks.log("WEBRTC_LIFECYCLE", "No local stream available to add tracks.");
    }
}

export async function startPeerConnection(targetId, isCaller, callType, localStream, rtcConfig) {
    callbacks.log('WEBRTC_LIFECYCLE', `Starting PeerConnection. Is caller: ${isCaller}`);
    await createPeerConnection(rtcConfig, localStream, callbacks.getSelectedAudioOutId());

    if (isCaller) {
        callbacks.log('WEBSOCKET_MESSAGES', 'Creating DataChannel.');
        dataChannel = peerConnection.createDataChannel('control');
        setupDataChannelEvents(dataChannel);

        const offerOptions = {
            offerToReceiveAudio: true, 
            offerToReceiveVideo: callType === 'video' 
        };
        callbacks.log('WEBRTC_SIGNALS', `Creating Offer with options:`, offerOptions);
        const offer = await peerConnection.createOffer(offerOptions);

        // --- ПРИМЕНЯЕМ НАСТРОЙКИ АУДИО (16k Mono) ---
        const modifiedSdp = setAudioPreferences(offer.sdp);
        const modifiedOffer = { type: offer.type, sdp: modifiedSdp };
        callbacks.log('WEBRTC_SIGNALS', 'Applied audio constraints (16kHz/Mono) to Offer.');

        await peerConnection.setLocalDescription(modifiedOffer);
        sendMessage({ type: 'offer', data: { target_id: targetId, offer: modifiedOffer } });
    }
}

async function processIceCandidateQueue() {
    while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        try {
            await peerConnection.addIceCandidate(candidate);
            callbacks.log("WEBRTC_SIGNALS", "Added a queued ICE candidate.");
        } catch (e) {
            callbacks.log('CRITICAL_ERROR', `ERROR adding queued ICE candidate: ${e}`);
        }
    }
}

export async function handleOffer(data, localStream, rtcConfig) {
    callbacks.log("WEBRTC_SIGNALS", "Received Offer, creating Answer.");
    if (!peerConnection) {
        await startPeerConnection(data.from, false, data.call_type, localStream, rtcConfig);
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    
    const answer = await peerConnection.createAnswer();
    
    // --- ПРИМЕНЯЕМ НАСТРОЙКИ АУДИО (16k Mono) ---
    const modifiedSdp = setAudioPreferences(answer.sdp);
    const modifiedAnswer = { type: answer.type, sdp: modifiedSdp };
    callbacks.log('WEBRTC_SIGNALS', 'Applied audio constraints (16kHz/Mono) to Answer.');

    await peerConnection.setLocalDescription(modifiedAnswer);
    sendMessage({ type: 'answer', data: { target_id: data.from, answer: modifiedAnswer } });
    
    callbacks.onCallConnected();
    processIceCandidateQueue();
}

export async function handleAnswer(data) {
    callbacks.log("WEBRTC_SIGNALS", "Received Answer.");
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
            callbacks.log("WEBRTC_SIGNALS", "Queued an ICE candidate.");
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
    callbacks.log('WEBRTC_LIFECYCLE', 'Peer connection resources cleaned up.');
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
            callbacks.log("UI_INTERACTIONS", "Screen sharing started.");
        } catch (error) {
            callbacks.log('CRITICAL_ERROR', `Could not start screen sharing: ${error.message}`);
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
        callbacks.log("UI_INTERACTIONS", "Screen sharing stopped.");
    }
}

export async function switchInputDevice(kind, deviceId, localStream) {
    if (!localStream || !peerConnection) return null;
    callbacks.log('DEVICE_SWITCH', `Switching ${kind} input to deviceId: ${deviceId}`);

    try {
        const currentTrack = kind === 'video' ? localStream.getVideoTracks()[0] : localStream.getAudioTracks()[0];
        if (currentTrack) {
            currentTrack.stop();
        }

        // При переключении устройства также запрашиваем оптимальные параметры
        const constraints = { 
            deviceId: { exact: deviceId } 
        };
        if (kind === 'audio') {
            constraints.channelCount = 1;
            constraints.sampleRate = 16000;
        }

        const newStream = await navigator.mediaDevices.getUserMedia({ [kind]: constraints });
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
        callbacks.log('CRITICAL_ERROR', `Error switching ${kind} device: ${error}`);
        return null;
    }
}

export function getPeerConnection() {
    return peerConnection;
}