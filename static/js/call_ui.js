import { ICONS } from './icons.js';


export const preCallCheckScreen = document.getElementById('pre-call-check-screen');
export const previewVideo = document.getElementById('previewVideo');
export const micLevelBars = document.querySelectorAll('.mic-level-bar');
export const cameraStatus = document.getElementById('camera-status');
export const cameraStatusText = document.getElementById('camera-status-text');
export const micStatus = document.getElementById('mic-status');
export const micStatusText = document.getElementById('mic-status-text');
export const continueToCallBtn = document.getElementById('continue-to-call-btn');
export const continueSpectatorBtn = document.getElementById('continue-spectator-btn');
export const cameraSelect = document.getElementById('camera-select');
export const micSelect = document.getElementById('mic-select');
export const speakerSelect = document.getElementById('speaker-select');
export const cameraSelectContainer = document.getElementById('camera-select-container');
export const micSelectContainer = document.getElementById('mic-select-container');
export const speakerSelectContainer = document.getElementById('speaker-select-container');

export const preCallScreen = document.getElementById('pre-call-screen');
export const popupWaiting = document.getElementById('popup-waiting');
export const popupActions = document.getElementById('popup-actions');
export const popupInitiating = document.getElementById('popup-initiating');
export const lifetimeTimer = document.getElementById('lifetime-timer');
export const closeSessionBtn = document.getElementById('close-session-btn');
export const instructionsBtn = document.getElementById('instructions-btn');
export const instructionsModal = document.getElementById('instructions-modal');
export const closeInstructionsBtns = document.querySelectorAll('.close-instructions-btn');

export const callScreen = document.getElementById('call-screen');
export const audioCallVisualizer = document.getElementById('audio-call-visualizer');
export const localGlow = document.getElementById('local-glow');
export const remoteGlow = document.getElementById('remote-glow');
export const incomingCallModal = document.getElementById('incoming-call-modal');
export const callerName = document.getElementById('caller-name');
export const incomingCallType = document.getElementById('incoming-call-type');
export const acceptBtn = document.getElementById('accept-btn');
export const declineBtn = document.getElementById('decline-btn');
export const hangupBtn = document.getElementById('hangup-btn');
export const remoteUserName = document.getElementById('remote-user-name');
export const callTimer = document.getElementById('call-timer');
export const speakerBtn = document.getElementById('speaker-btn');
export const muteBtn = document.getElementById('mute-btn');
export const videoBtn = document.getElementById('video-btn');
export const videoControlItem = document.getElementById('video-control-item');
export const switchCameraBtn = document.getElementById('switch-camera-btn');
export const switchCameraControlItem = document.getElementById('switch-camera-control-item');
export const screenShareBtn = document.getElementById('screen-share-btn');
export const screenShareControlItem = document.getElementById('screen-share-control-item');
export const localAudio = document.getElementById('localAudio');
export const remoteAudio = document.getElementById('remoteAudio');
export const localVideo = document.getElementById('localVideo');
export const remoteVideo = document.getElementById('remoteVideo');
export const localVideoContainer = document.getElementById('local-video-container');
export const toggleLocalViewBtn = document.getElementById('toggle-local-view-btn');
export const toggleRemoteViewBtn = document.getElementById('toggle-remote-view-btn');
export const ringOutAudio = document.getElementById('ringOutAudio');
export const connectAudio = document.getElementById('connectAudio');
export const ringInAudio = document.getElementById('ringInAudio');
export const connectionStatus = document.getElementById('connection-status');
export const connectionQuality = document.getElementById('connection-quality');
export const qualityGoodSvg = document.getElementById('quality-good-svg');
export const qualityMediumSvg = document.getElementById('quality-medium-svg');
export const qualityBadSvg = document.getElementById('quality-bad-svg');
export const remoteAudioLevel = document.getElementById('remote-audio-level');
export const remoteAudioLevelBars = document.querySelectorAll('.remote-audio-level-bar');
export const connectionInfoPopup = document.getElementById('connection-info-popup');
export const remoteMuteToast = document.getElementById('remote-mute-toast');
export const connectionToast = document.getElementById('connection-toast');

export const deviceSettingsBtn = document.getElementById('device-settings-btn');
export const deviceSettingsModal = document.getElementById('device-settings-modal');
export const closeSettingsBtns = document.querySelectorAll('.close-settings-btn');
export const cameraSelectCall = document.getElementById('camera-select-call');
export const micSelectCall = document.getElementById('mic-select-call');
export const speakerSelectCall = document.getElementById('speaker-select-call');
export const cameraSelectContainerCall = document.getElementById('camera-select-container-call');
export const micSelectContainerCall = document.getElementById('mic-select-container-call');
export const speakerSelectContainerCall = document.getElementById('speaker-select-container-call');


export function loadIcons() {
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

loadIcons();


export function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (screenName) document.getElementById(`${screenName}-screen`).classList.add('active');
}

export function showModal(modalName, show) {
    const modal = document.getElementById(`${modalName}-modal`);
    if (modal) modal.classList.toggle('active', show);
}

export function showPopup(popupName) {
    document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
    if (popupName) document.getElementById(`popup-${popupName}`).classList.add('active');
}

export function resetUiFade(uiFadeTimeout) {
    callScreen.classList.add('ui-interactive');
    callScreen.classList.remove('ui-faded');
    clearTimeout(uiFadeTimeout);
    const newTimeout = setTimeout(() => callScreen.classList.add('ui-faded'), 2000);
    setTimeout(() => callScreen.classList.remove('ui-interactive'), 150);
    return newTimeout;
}

export function setupVideoCallUiListeners(handler) {
    callScreen.addEventListener('mousemove', handler);
    callScreen.addEventListener('click', handler);
    callScreen.addEventListener('touchstart', handler);
}

export function removeVideoCallUiListeners(handler) {
    callScreen.removeEventListener('mousemove', handler);
    callScreen.removeEventListener('click', handler);
    callScreen.removeEventListener('touchstart', handler);
}

export function startTimer(callScreen, callTimer, remoteUserName, currentCallType, setTimerInterval) {
    callScreen.classList.add('call-connected');
    let seconds = 0;
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'none';
    
    const intervalId = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        callTimer.textContent = `${mins}:${secs}`;
    }, 1000);
    setTimerInterval(intervalId);

    if (currentCallType === 'video') {
        setupVideoCallUiListeners(() => {
            
        });
        // resetUiFade(); // This needs the timeout variable from the main script
    } else {
        audioCallVisualizer.style.display = 'flex';
    }

    connectionQuality.classList.add('active');
}

export function stopTimer(callTimerInterval, callTimer, remoteUserName) {
    clearInterval(callTimerInterval);
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'block';
    return null;
}

export function visualizeMic(stream, bars) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);

    let animationFrameId;
    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const volume = Math.min(Math.floor(average / 15), bars.length);

        bars.forEach((bar, index) => {
            bar.classList.toggle('active', index < volume);
        });
    }
    draw();
    return { id: animationFrameId, context: audioContext };
}

export function visualizeLocalMicForCall(stream, glowElement) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);

    let animationFrameId;
    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const intensity = Math.min(average / 100, 1.0);
        glowElement.style.setProperty('--glow-intensity', intensity);
    }
    draw();
    return { id: animationFrameId, context: audioContext };
}

export function visualizeRemoteMic(stream, glowElement, bars) {
    remoteAudioLevel.style.display = 'flex';
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    let animationFrameId;
    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        
        const intensity = Math.min(average / 100, 1.0);
        glowElement.style.setProperty('--glow-intensity', intensity);

        const maxVolume = 160;
        const percentage = Math.min((average / maxVolume) * 100, 100);
        let level = 0;
        if (percentage > 90) level = 5;
        else if (percentage > 70) level = 4;
        else if (percentage > 35) level = 3;
        else if (percentage > 10) level = 2;
        else if (average > 1) level = 1;
        bars.forEach((bar, index) => bar.classList.toggle('active', index < level));
    }
    draw();
    return { id: animationFrameId, context: audioContext };
}

export function updateStatusIndicators(hasCamera, hasMic) {
    cameraStatus.classList.toggle('status-ok', hasCamera);
    cameraStatus.classList.toggle('status-error', !hasCamera);
    cameraStatusText.textContent = `Камера: ${hasCamera ? 'OK' : 'Нет доступа'}`;

    micStatus.classList.toggle('status-ok', hasMic);
    micStatus.classList.toggle('status-error', !hasMic);
    micStatusText.textContent = `Микрофон: ${hasMic ? 'OK' : 'Нет доступа'}`;
}

export function displayMediaErrors(error) {
    let message = 'Не удалось получить доступ к камере и/или микрофону. ';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message += 'Вы заблокировали доступ. Пожалуйста, измените разрешения в настройках браузера.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        message += 'Устройства не найдены. Убедитесь, что они подключены и работают.';
    } else {
        message += 'Произошла ошибка. Попробуйте перезагрузить страницу.';
    }

    console.error(message);
}

export function updateCallUI(currentCallType, hasCameraAccess, hasMicrophoneAccess, targetUser) {
    remoteUserName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    const isVideoCall = currentCallType === 'video';
    videoControlItem.style.display = isVideoCall && hasCameraAccess ? 'flex' : 'none';
    muteBtn.parentElement.style.display = hasMicrophoneAccess ? 'flex' : 'none';
    screenShareControlItem.style.display = isVideoCall && !isMobileDevice() ? 'flex' : 'none';
    remoteVideo.style.display = isVideoCall ? 'block' : 'none';
    
    callScreen.classList.toggle('video-call-active', isVideoCall);
    callScreen.classList.toggle('audio-call-active', !isVideoCall);
}

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

export function updateConnectionIcon(type) {
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
    const qualityText = connectionStatus.title.split(' / ') || 'Качество соединения';
    connectionStatus.title = `${qualityText} / ${title}`;
}

export function updateConnectionQualityIcon(quality) {
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

export function showConnectionInfo(currentConnectionDetails) {
    if (!currentConnectionDetails) return;

    connectionInfoPopup.textContent = `${currentConnectionDetails.region}, ${currentConnectionDetails.provider}`;
    connectionInfoPopup.classList.add('active');
   
}

export function showConnectionToast(type, message) {
    connectionToast.textContent = message;
    connectionToast.classList.remove('toast-good', 'toast-bad');
    connectionToast.classList.add(`toast-${type}`);
    connectionToast.classList.add('visible');
    setTimeout(() => {
        connectionToast.classList.remove('visible');
    }, 7000);
}