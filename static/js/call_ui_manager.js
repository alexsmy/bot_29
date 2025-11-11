import {
    preCallCheckScreen, preCallScreen, callScreen, instructionsModal, deviceSettingsModal,
    incomingCallModal, popupWaiting, popupActions, popupInitiating,
    cameraStatus, cameraStatusText, micStatus, micStatusText, continueSpectatorBtn,
    remoteUserName, callTimer, videoControlItem, muteBtn, screenShareControlItem,
    remoteVideo, localVideoContainer, audioCallVisualizer, connectionStatus,
    connectionQuality, qualityGoodSvg, qualityMediumSvg, qualityBadSvg,
    remoteMuteToast, connectionToast, connectionInfoPopup,
    localVideo, toggleLocalViewBtn, toggleRemoteViewBtn,
    callingOverlay, callingOverlayTitle, standaloneChatScreen, connectionStatusChat,
    inCallChatModal, chatBtn, typingToast
} from './call_ui_elements.js';

let uiFadeTimeout = null;
let remoteMuteToastTimeout = null;
let connectionToastTimeout = null;
let typingToastTimeout = null;
let infoPopupTimeout = null;

// --- Управление экранами и модальными окнами ---

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

export function showCallingOverlay(show, callType = 'audio') {
    if (show) {
        let title = 'Аудиовызов...';
        if (callType === 'video') title = 'Видеовызов...';
        if (callType === 'chat') title = 'Ожидание собеседника в чате...';
        callingOverlayTitle.textContent = title;
        callingOverlay.classList.add('active');
    } else {
        callingOverlay.classList.remove('active');
    }
}

// --- Обновление UI в зависимости от состояния ---

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
    continueSpectatorBtn.style.display = 'block';
}

export function updateCallUI(callType, targetUser, mediaStatus, isMobile) {
    remoteUserName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    const isVideoCall = callType === 'video';
    const { hasCameraAccess, hasMicrophoneAccess } = mediaStatus;

    videoControlItem.style.display = isVideoCall && hasCameraAccess ? 'flex' : 'none';
    muteBtn.parentElement.style.display = hasMicrophoneAccess ? 'flex' : 'none';
    screenShareControlItem.style.display = isVideoCall && !isMobile ? 'flex' : 'none';

    remoteVideo.style.display = isVideoCall ? 'block' : 'none';

    callScreen.classList.toggle('video-call-active', isVideoCall);
    callScreen.classList.toggle('audio-call-active', !isVideoCall);
}

export function resetCallControls() {
    muteBtn.classList.remove('active');
    videoControlItem.querySelector('#video-btn').classList.remove('active');
    document.getElementById('speaker-btn').classList.remove('active');
    screenShareControlItem.querySelector('#screen-share-btn').classList.remove('active');
    
    localVideo.classList.remove('force-cover');
    remoteVideo.classList.remove('force-cover');
    
    if (typeof ICONS !== 'undefined') {
        toggleLocalViewBtn.querySelector('.icon').innerHTML = ICONS.localViewContain;
        toggleRemoteViewBtn.querySelector('.icon').innerHTML = ICONS.remoteViewCover;
    }

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

// --- Управление таймерами и визуальными эффектами ---

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

export function startCallTimer(callType) {
    callScreen.classList.add('call-connected');
    let seconds = 0;
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'none';
    
    const timerInterval = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        callTimer.textContent = `${mins}:${secs}`;
    }, 1000);

    if (callType === 'video') {
        setupVideoCallUiListeners();
        resetUiFade();
    } else {
        audioCallVisualizer.style.display = 'flex';
    }
    
    return timerInterval;
}

export function stopCallTimer(intervalId) {
    if (intervalId) clearInterval(intervalId);
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'block';
}

// --- Уведомления и статусы соединения ---

export function updateConnectionIcon(type) {
    const template = document.getElementById('connection-status-template');
    if (!template) return;

    const statusElements = [connectionStatus, connectionStatusChat];
    statusElements.forEach(el => {
        if (!el) return;
        el.innerHTML = template.innerHTML; // Копируем структуру
        
        const typeMap = {
            local: { id: 'conn-local', title: 'Прямое локальное соединение (LAN)' },
            p2p: { id: 'conn-p2p', title: 'Прямое P2P соединение (Direct)' },
            relay: { id: 'conn-relay', title: 'Соединение через сервер (Relay)' },
            unknown: { id: 'conn-unknown', title: 'Определение типа соединения...' }
        };
        const { id, title } = typeMap[type] || typeMap.unknown;
        const iconToShow = el.querySelector(`#${id}`);
        if (iconToShow) iconToShow.classList.add('active');
        
        el.setAttribute('data-type-title', title);
        const qualityText = el.title.split(' / ')[0] || 'Качество соединения';
        el.title = `${qualityText} / ${title}`;
    });
}

export function updateConnectionQualityIcon(quality) {
    const qualityElements = document.querySelectorAll('#connection-quality');
    qualityElements.forEach(el => {
        el.classList.remove('quality-good', 'quality-medium', 'quality-bad');
        el.querySelectorAll('.quality-svg').forEach(svg => {
            // ИСПРАВЛЕНИЕ: Убрали прямое управление стилем display
            svg.classList.remove('active-quality-svg');
        });
        const qualityMap = {
            good: { class: 'quality-good', text: 'Отличное соединение', svgId: 'quality-good-svg' },
            medium: { class: 'quality-medium', text: 'Среднее соединение', svgId: 'quality-medium-svg' },
            bad: { class: 'quality-bad', text: 'Плохое соединение', svgId: 'quality-bad-svg' },
            unknown: { class: '', text: 'Оценка качества...', svgId: null }
        };
        const { class: qualityClass, text: qualityText, svgId } = qualityMap[quality] || qualityMap.unknown;
        if (qualityClass) el.classList.add(qualityClass);
        const activeSvg = el.querySelector(`#${svgId}`);
        if (activeSvg) {
            // ИСПРАВЛЕНИЕ: Убрали прямое управление стилем display, теперь только добавляем класс
            activeSvg.classList.add('active-quality-svg');
        }
        const parentStatus = el.closest('[title]');
        if (parentStatus) {
            const typeTitle = parentStatus.getAttribute('data-type-title') || 'Определение типа...';
            parentStatus.title = `${qualityText} / ${typeTitle}`;
        }
    });
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

export function showConnectionToast(type, message) {
    clearTimeout(connectionToastTimeout);
    
    let finalMessage = message;
    if (type === 'good') {
        finalMessage += ' 🌍';
    } else if (type === 'warning') {
        finalMessage += ' 📡';
    }
    
    connectionToast.textContent = finalMessage;
    connectionToast.className = 'toast-notification';
    connectionToast.classList.add(`toast-${type}`);
    
    connectionToast.classList.add('visible');
    
    connectionToastTimeout = setTimeout(() => {
        connectionToast.classList.remove('visible');
    }, 2000);
}

export function handleRemoteMuteStatus(isMuted) {
    clearTimeout(remoteMuteToastTimeout);
    if (isMuted) {
        remoteMuteToast.textContent = "Собеседник выключил микрофон. 🔇";
    } else {
        remoteMuteToast.textContent = "Микрофон снова включён. 🎤";
    }
    remoteMuteToast.classList.add('visible');
    remoteMuteToastTimeout = setTimeout(() => {
        remoteMuteToast.classList.remove('visible');
    }, 2000);
}

// --- НОВЫЕ ФУНКЦИИ ДЛЯ ЧАТА ---

export function showTypingToast(show) {
    clearTimeout(typingToastTimeout);
    if (show) {
        typingToast.textContent = "Собеседник печатает...";
        typingToast.classList.add('visible');
        typingToastTimeout = setTimeout(() => {
            typingToast.classList.remove('visible');
        }, 2000);
    } else {
        typingToast.classList.remove('visible');
    }
}

export function toggleChatButtonGlow(show) {
    chatBtn.classList.toggle('has-unread', show);
}

export function renderChatMessage(message, historyElement, isSentByCurrentUser) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', isSentByCurrentUser ? 'sent' : 'received');
    messageDiv.dataset.messageId = message.id;

    const contentP = document.createElement('p');
    contentP.textContent = message.content;
    messageDiv.appendChild(contentP);

    if (isSentByCurrentUser) {
        const metaDiv = document.createElement('div');
        metaDiv.classList.add('message-meta');
        
        const timeSpan = document.createElement('span');
        timeSpan.textContent = new Date(message.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        const statusSpan = document.createElement('span');
        statusSpan.classList.add('message-status');
        statusSpan.innerHTML = ICONS.check; // Sent status
        
        metaDiv.appendChild(timeSpan);
        metaDiv.appendChild(statusSpan);
        messageDiv.appendChild(metaDiv);
    }

    historyElement.appendChild(messageDiv);
    historyElement.scrollTop = historyElement.scrollHeight;
}

export function updateMessageStatusInUI(messageId, status) {
    const messageDivs = document.querySelectorAll(`.chat-message[data-message-id="${messageId}"]`);
    messageDivs.forEach(messageDiv => {
        const statusSpan = messageDiv.querySelector('.message-status');
        if (statusSpan && status === 'read') {
            statusSpan.innerHTML = ICONS.doubleCheck;
            statusSpan.classList.add('read');
        }
    });
}

export function showTypingIndicator(indicatorElement, show) {
    indicatorElement.classList.toggle('visible', show);
    if (show) {
        indicatorElement.textContent = "Собеседник печатает...";
    }
}