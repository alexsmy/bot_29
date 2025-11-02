### static/js/call_media.js
``````javascript
// static/js/call_media.js

let localStream;
let previewStream;
let micVisualizer;
let localCallMicVisualizer;
let remoteMicVisualizer;
let localAudioContext;
let remoteAudioContext;
let remoteGainNode = null;
let isRemoteMuted = false;

let videoDevices = [];
let audioInDevices = [];
let audioOutDevices = [];

let hasMicrophoneAccess = false;
let hasCameraAccess = false;

let log = () => {};

export function init(logger) {
    log = logger;
}

export function getMediaAccessStatus() {
    return { hasCameraAccess, hasMicrophoneAccess };
}

export function getLocalStream() {
    return localStream;
}

export function stopAllStreams() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    stopPreviewStream();
    if (localCallMicVisualizer) cancelAnimationFrame(localCallMicVisualizer);
    if (remoteMicVisualizer) cancelAnimationFrame(remoteMicVisualizer);
    if (localAudioContext) localAudioContext.close();
    if (remoteAudioContext) remoteAudioContext.close();
    localCallMicVisualizer = null;
    remoteMicVisualizer = null;
    localAudioContext = null;
    remoteAudioContext = null;
    remoteGainNode = null;
}

export function stopPreviewStream() {
    if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
        previewStream = null;
    }
    if (micVisualizer) {
        cancelAnimationFrame(micVisualizer);
        micVisualizer = null;
    }
}

export async function initializePreview(videoElement, micLevelBars) {
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        hasCameraAccess = true;
        hasMicrophoneAccess = true;
    } catch (error) {
        log(`[MEDIA_CHECK] Combined media request failed: ${error.name}. Trying separately.`);
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
    }

    if (stream) {
        previewStream = stream;
        videoElement.srcObject = stream;
        if (hasMicrophoneAccess) visualizeMic(previewStream, micLevelBars);
    } else {
        log('[MEDIA_CHECK] No media devices available or access denied to all.');
    }
    
    return { hasCameraAccess, hasMicrophoneAccess };
}

export async function populateDeviceSelectors(cameraSelect, micSelect, speakerSelect, cameraContainer, micContainer, speakerContainer) {
    // Запрашиваем устройства еще раз, т.к. после getUserMedia список может обновиться
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(d => d.kind === 'videoinput');
    audioInDevices = devices.filter(d => d.kind === 'audioinput');
    audioOutDevices = devices.filter(d => d.kind === 'audiooutput');

    const populate = (select, devicesList, container) => {
        // Показываем контейнер, если есть хотя бы одно устройство
        container.style.display = devicesList.length > 0 ? 'flex' : 'none';
        if (devicesList.length === 0) return;

        select.innerHTML = '';
        devicesList.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `${select.id} ${select.options.length + 1}`;
            select.appendChild(option);
        });
    };

    populate(cameraSelect, videoDevices, cameraContainer);
    populate(micSelect, audioInDevices, micContainer);
    // Особенно важно для мобильных: этот список часто пуст до getUserMedia
    populate(speakerSelect, audioOutDevices, speakerContainer);
    
    return {
        videoId: cameraSelect.value,
        audioInId: micSelect.value,
        audioOutId: speakerSelect.value
    };
}

export async function updatePreviewStream(constraints, videoElement, micLevelBars) {
    stopPreviewStream();
    if (!constraints.audio && !constraints.video) return;

    try {
        previewStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = previewStream;
        if (hasMicrophoneAccess) visualizeMic(previewStream, micLevelBars);
    } catch (error) {
        log(`[MEDIA_UPDATE] Error updating preview stream: ${error}`);
    }
}

export async function getStreamForCall(constraints, localVideoEl, localAudioEl) {
    if (localStream) localStream.getTracks().forEach(track => track.stop());

    if (!constraints.audio && !constraints.video) {
        log("[MEDIA] No media access granted for selected devices. Proceeding without local stream.");
        return { stream: null, isVideo: false };
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        log("[MEDIA] Media stream acquired successfully.");
        localAudioEl.srcObject = localStream;
        visualizeLocalMicForCall(localStream);

        const isVideo = constraints.video && localStream.getVideoTracks().length > 0;
        if (isVideo) {
            localVideoEl.srcObject = localStream;
            await localVideoEl.play();
        }
        
        return { stream: localStream, isVideo: isVideo };
    } catch (error) {
        log(`[MEDIA] ERROR getting media: ${error.name} - ${error.message}`);
        return { stream: null, isVideo: false };
    }
}

function visualizeMic(stream, micLevelBars) {
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

export function visualizeLocalMicForCall(stream) {
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
        document.getElementById('local-glow').style.setProperty('--glow-intensity', intensity);
    }
    draw();
}

export function visualizeRemoteMic(stream) {
    if (remoteMicVisualizer) cancelAnimationFrame(remoteMicVisualizer);
    if (remoteAudioContext) remoteAudioContext.close();

    const remoteAudioLevel = document.getElementById('remote-audio-level');
    const remoteGlow = document.getElementById('remote-glow');
    const remoteAudioLevelBars = document.querySelectorAll('.remote-audio-level-bar');

    if (!stream || stream.getAudioTracks().length === 0) {
        log("[REMOTE_MIC] No audio track found in remote stream to visualize.");
        remoteAudioLevel.style.display = 'none';
        return;
    }

    remoteAudioLevel.style.display = 'flex';
    remoteAudioContext = new AudioContext();
    const source = remoteAudioContext.createMediaStreamSource(stream);
    const analyser = remoteAudioContext.createAnalyser();
    analyser.fftSize = 256;
    
    remoteGainNode = remoteAudioContext.createGain();
    remoteGainNode.gain.value = isRemoteMuted ? 0 : 1;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    source.connect(analyser);
    analyser.connect(remoteGainNode);
    remoteGainNode.connect(remoteAudioContext.destination);

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

export function toggleRemoteSpeakerMute() {
    isRemoteMuted = !isRemoteMuted;
    if (remoteGainNode) {
        remoteGainNode.gain.value = isRemoteMuted ? 0 : 1;
    }
    return isRemoteMuted;
}