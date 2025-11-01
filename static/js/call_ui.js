
import { ICONS } from './icons.js';

// --- DOM Element Variables (to be initialized) ---
export let preCallCheckScreen, previewVideo, micLevelBars, cameraStatus, cameraStatusText,
micStatus, micStatusText, continueToCallBtn, continueSpectatorBtn, cameraSelect,
micSelect, speakerSelect, cameraSelectContainer, micSelectContainer, speakerSelectContainer,
preCallScreen, popupWaiting, popupActions, popupInitiating, lifetimeTimer,
closeSessionBtn, instructionsBtn, instructionsModal, closeInstructionsBtns,
callScreen, audioCallVisualizer, localGlow, remoteGlow, incomingCallModal,
callerName, incomingCallType, acceptBtn, declineBtn, hangupBtn, remoteUserName,
callTimer, speakerBtn, muteBtn, videoBtn, videoControlItem, screenShareBtn,
screenShareControlItem, localAudio, remoteAudio, localVideo, remoteVideo,
localVideoContainer, toggleLocalViewBtn, toggleRemoteViewBtn, ringOutAudio,
connectAudio, ringInAudio, connectionStatus, connectionQuality, qualityGoodSvg,
qualityMediumSvg, qualityBadSvg, remoteAudioLevel, remoteAudioLevelBars,
connectionInfoPopup, remoteMuteToast, connectionToast, deviceSettingsBtn,
deviceSettingsModal, closeSettingsBtns, cameraSelectCall, micSelectCall,
speakerSelectCall, cameraSelectContainerCall, micSelectContainerCall,
speakerSelectContainerCall;

// --- UI Initialization ---
export function initUI() {
preCallCheckScreen = document.getElementById('pre-call-check-screen');
previewVideo = document.getElementById('previewVideo');
micLevelBars = document.querySelectorAll('.mic-level-bar');
cameraStatus = document.getElementById('camera-status');
cameraStatusText = document.getElementById('camera-status-text');
micStatus = document.getElementById('mic-status');
micStatusText = document.getElementById('mic-status-text');
continueToCallBtn = document.getElementById('continue-to-call-btn');
continueSpectatorBtn = document.getElementById('continue-spectator-btn');
cameraSelect = document.getElementById('camera-select');
micSelect = document.getElementById('mic-select');
speakerSelect = document.getElementById('speaker-select');
cameraSelectContainer = document.getElementById('camera-select-container');
micSelectContainer = document.getElementById('mic-select-container');
speakerSelectContainer = document.getElementById('speaker-select-container');
preCallScreen = document.getElementById('pre-call-screen');
popupWaiting = document.getElementById('popup-waiting');
popupActions = document.getElementById('popup-actions');
popupInitiating = document.getElementById('popup-initiating');
lifetimeTimer = document.getElementById('lifetime-timer');
closeSessionBtn = document.getElementById('close-session-btn');
instructionsBtn = document.getElementById('instructions-btn');
instructionsModal = document.getElementById('instructions-modal');
closeInstructionsBtns = document.querySelectorAll('.close-instructions-btn');
callScreen = document.getElementById('call-screen');
audioCallVisualizer = document.getElementById('audio-call-visualizer');
localGlow = document.getElementById('local-glow');
remoteGlow = document.getElementById('remote-glow');
incomingCallModal = document.getElementById('incoming-call-modal');
callerName = document.getElementById('caller-name');
incomingCallType = document.getElementById('incoming-call-type');
acceptBtn = document.getElementById('accept-btn');
declineBtn = document.getElementById('decline-btn');
hangupBtn = document.getElementById('hangup-btn');
remoteUserName = document.getElementById('remote-user-name');
callTimer = document.getElementById('call-timer');
speakerBtn = document.getElementById('speaker-btn');
muteBtn = document.getElementById('mute-btn');
videoBtn = document.getElementById('video-btn');
videoControlItem = document.getElementById('video-control-item');
screenShareBtn = document.getElementById('screen-share-btn');
screenShareControlItem = document.getElementById('screen-share-control-item');
localAudio = document.getElementById('localAudio');
remoteAudio = document.getElementById('remoteAudio');
localVideo = document.getElementById('localVideo');
remoteVideo = document.getElementById('remoteVideo');
localVideoContainer = document.getElementById('local-video-container');
toggleLocalViewBtn = document.getElementById('toggle-local-view-btn');
toggleRemoteViewBtn = document.getElementById('toggle-remote-view-btn');
ringOutAudio = document.getElementById('ringOutAudio');
connectAudio = document.getElementById('connectAudio');
ringInAudio = document.getElementById('ringInAudio');
connectionStatus = document.getElementById('connection-status');
connectionQuality = document.getElementById('connection-quality');
qualityGoodSvg = document.getElementById('quality-good-svg');
qualityMediumSvg = document.getElementById('quality-medium-svg');
qualityBadSvg = document.getElementById('quality-bad-svg');
remoteAudioLevel = document.getElementById('remote-audio-level');
remoteAudioLevelBars = document.querySelectorAll('.remote-audio-level-bar');
connectionInfoPopup = document.getElementById('connection-info-popup');
remoteMuteToast = document.getElementById('remote-mute-toast');
connectionToast = document.getElementById('connection-toast');
deviceSettingsBtn = document.getElementById('device-settings-btn');
deviceSettingsModal = document.getElementById('device-settings-modal');
closeSettingsBtns = document.querySelectorAll('.close-settings-btn');
cameraSelectCall = document.getElementById('camera-select-call');
micSelectCall = document.getElementById('mic-select-call');
speakerSelectCall = document.getElementById('speaker-select-call');
cameraSelectContainerCall = document.getElementById('camera-select-container-call');
micSelectContainerCall = document.getElementById('mic-select-container-call');
speakerSelectContainerCall = document.getElementById('speaker-select-container-call');

code
Code
download
content_copy
expand_less
loadIcons();

}

// --- UI Function Exports ---

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
console.warn(Icon with name "${iconName}" not found.);
}
});
}

export function showScreen(screenName) {
document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
if (screenName) document.getElementById(${screenName}-screen).classList.add('active');
}

export function showModal(modalName, show) {
const modal = document.getElementById(${modalName}-modal);
if (modal) modal.classList.toggle('active', show);
}

export function showPopup(popupName) {
document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
if (popupName) document.getElementById(popup-${popupName}).classList.add('active');
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

export function startTimer() {
callScreen.classList.add('call-connected');
let seconds = 0;
callTimer.textContent = '00:00';
remoteUserName.style.display = 'none';

code
Code
download
content_copy
expand_less
const intervalId = setInterval(() => {
    seconds++;
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    callTimer.textContent = `${mins}:${secs}`;
}, 1000);

connectionQuality.classList.add('active');
return intervalId;

}

export function stopTimer(intervalId) {
clearInterval(intervalId);
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

code
Code
download
content_copy
expand_less
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

code
Code
download
content_copy
expand_less
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

export function visualizeRemoteMic(stream) {
remoteAudioLevel.style.display = 'flex';
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);
source.connect(analyser);
analyser.connect(audioContext.destination);

code
Code
download
content_copy
expand_less
let animationFrameId;
function draw() {
    animationFrameId = requestAnimationFrame(draw);
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
return { id: animationFrameId, context: audioContext };

}

export function updateStatusIndicators(hasCamera, hasMic) {
cameraStatus.classList.toggle('status-ok', hasCamera);
cameraStatus.classList.toggle('status-error', !hasCamera);
cameraStatusText.textContent = Камера: ${hasCamera ? 'OK' : 'Нет доступа'};

code
Code
download
content_copy
expand_less
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
remoteUserName.textContent = ${targetUser?.first_name || 'Собеседник'};
const isVideoCall = currentCallType === 'video';
videoControlItem.style.display = isVideoCall && hasCameraAccess ? 'flex' : 'none';
muteBtn.parentElement.style.display = hasMicrophoneAccess ? 'flex' : 'none';
screenShareControlItem.style.display = isVideoCall && !isMobileDevice() ? 'flex' : 'none';
remoteVideo.style.display = isVideoCall ? 'block' : 'none';

code
Code
download
content_copy
expand_less
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
const qualityText = (connectionStatus.title.split(' / ')) || 'Качество соединения';
connectionStatus.title = ${qualityText} / ${title};
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
connectionStatus.title = ${qualityText} / ${typeTitle};
}

export function showConnectionInfo(currentConnectionDetails) {
if (!currentConnectionDetails) return;
let infoPopupTimeout;
clearTimeout(infoPopupTimeout);
connectionInfoPopup.textContent = ${currentConnectionDetails.region}, ${currentConnectionDetails.provider};
connectionInfoPopup.classList.add('active');
infoPopupTimeout = setTimeout(() => {
connectionInfoPopup.classList.remove('active');
}, 3000);
}

export function showConnectionToast(type, message) {
connectionToast.textContent = message;
connectionToast.classList.remove('toast-good', 'toast-bad');
connectionToast.classList.add(toast-${type});
connectionToast.classList.add('visible');
setTimeout(() => {
connectionToast.classList.remove('visible');
}, 7000);
}

export function setupEventListeners(handlers) {
continueToCallBtn.addEventListener('click', () => handlers.proceedToCall(false));
continueSpectatorBtn.addEventListener('click', () => handlers.proceedToCall(true));
cameraSelect.addEventListener('change', handlers.updatePreviewStream);
micSelect.addEventListener('change', handlers.updatePreviewStream);
speakerSelect.addEventListener('change', handlers.updatePreviewStream);

code
Code
download
content_copy
expand_less
speakerBtn.addEventListener('click', handlers.toggleSpeaker);
muteBtn.addEventListener('click', handlers.toggleMute);
videoBtn.addEventListener('click', handlers.toggleVideo);
screenShareBtn.addEventListener('click', handlers.toggleScreenShare);
acceptBtn.addEventListener('click', handlers.acceptCall);
declineBtn.addEventListener('click', handlers.declineCall);

hangupBtn.addEventListener('click', handlers.endCall);

closeSessionBtn.addEventListener('click', handlers.closeSession);

instructionsBtn.addEventListener('click', () => instructionsModal.classList.add('active'));
closeInstructionsBtns.forEach(btn => btn.addEventListener('click', () => instructionsModal.classList.remove('active')));

deviceSettingsBtn.addEventListener('click', handlers.openDeviceSettings);
closeSettingsBtns.forEach(btn => btn.addEventListener('click', () => deviceSettingsModal.classList.remove('active')));
cameraSelectCall.addEventListener('change', (e) => handlers.switchInputDevice('video', e.target.value));
micSelectCall.addEventListener('change', (e) => handlers.switchInputDevice('audio', e.target.value));
speakerSelectCall.addEventListener('change', (e) => handlers.switchAudioOutput(e.target.value));

popupActions.addEventListener('click', (e) => {
    const button = e.target.closest('.action-call-btn');
    if (button) {
        handlers.initiateCall(button.dataset.callType);
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

connectionStatus.addEventListener('click', handlers.showConnectionInfo);

}