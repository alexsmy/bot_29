// static/js/call_ui_manager.js

import {
    callScreen, preCallScreen, preCallCheckScreen, popupWaiting, popupActions,
    popupInitiating, incomingCallModal, instructionsModal, deviceSettingsModal,
    callTimer, remoteUserName, videoControlItem, muteBtn, screenShareControlItem,
    remoteVideo, audioCallVisualizer, connectionQuality, qualityGoodSvg, qualityMediumSvg,
    qualityBadSvg, connectionStatus, connectionInfoPopup, remoteMuteToast, connectionToast,
    ringInAudio, screenShareBtn, localVideoContainer, remoteMuteToastTimeout,
    ICONS, toggleLocalViewBtn, toggleRemoteViewBtn,
} from './call_ui_elements.js';

let callTimerInterval;
let uiFadeTimeout;
let infoPopupTimeout;

// --- Управление видимостью экранов и окон ---

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

// --- Управление UI во время звонка ---

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

export function updateCallUI(currentCallType, targetUser, mediaAccess, isMobile) {
    remoteUserName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    const isVideoCall = currentCallType === 'video';

    videoControlItem.style.display = isVideoCall && mediaAccess.hasCameraAccess ? 'flex' : 'none';
    muteBtn.parentElement.style.display = mediaAccess.hasMicrophoneAccess ? 'flex' : 'none';
    screenShareControlItem.style.display = isVideoCall && !isMobile ? 'flex' : 'none';
    remoteVideo.style.display = isVideoCall ? 'block' : 'none';

    callScreen.classList.toggle('video-call-active', isVideoCall);
    callScreen.classList.toggle('audio-call-active', !isVideoCall);
}

export function resetCallControls() {
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
}

export function updateScreenShareUI(isSharing, isVideoEnabled, currentCallType) {
    screenShareBtn.classList.toggle('active', isSharing);
    localVideoContainer.style.display = isSharing ? 'none' : (isVideoEnabled && currentCallType === 'video' ? 'flex' : 'none');
}

// --- Управление таймером ---

export function startTimer(currentCallType) {
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

    connectionQuality.classList.add('active');
}

export function stopTimer() {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'block';
    callScreen.classList.remove('call-connected');
}

// --- Управление статусом соединения ---

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
    const qualityText = connectionStatus.title.split(' / ')[0] || 'Качество соединения';
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

export function showConnectionInfo(details) {
    if (!details) return;
    clearTimeout(infoPopupTimeout);
    connectionInfoPopup.textContent = `${details.region}, ${details.provider}`;
    connectionInfoPopup.classList.add('active');
    infoPopupTimeout = setTimeout(() => {
        connectionInfoPopup.classList.remove('active');
    }, 3000);
}

// --- Уведомления (Toasts) ---

export function showConnectionToast(type, message) {
    connectionToast.textContent = message;
    connectionToast.classList.remove('toast-good', 'toast-bad');
    connectionToast.classList.add(`toast-${type}`);
    connectionToast.classList.add('visible');
    setTimeout(() => {
        connectionToast.classList.remove('visible');
    }, 7000);
}

export function handleRemoteMuteStatus(isMuted) {
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
}

// --- Прочее ---

export function stopIncomingRing() {
    ringInAudio.pause();
    ringInAudio.currentTime = 0;
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
    // Placeholder for a more elegant error display
    console.error(message);
}