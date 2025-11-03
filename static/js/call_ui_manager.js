// static/js/call_ui_manager.js

import * as ui from './call_ui_elements.js';
import { ICONS } from './icons.js';

let callTimerInterval;
let uiFadeTimeout;
let remoteMuteToastTimeout;
let connectionToastTimeout;
let infoPopupTimeout;
let monitor; // Будет хранить ссылку на модуль мониторинга

/**
 * Инициализирует UI менеджер, передавая ему необходимые зависимости.
 * @param {object} dependencies - Объект с зависимостями.
 * @param {object} dependencies.monitor - Модуль call_connection_monitor.
 */
export function init(dependencies) {
    monitor = dependencies.monitor;
}

/**
 * Загружает и вставляет SVG иконки в плейсхолдеры.
 */
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

/**
 * Показывает указанный экран, скрывая остальные.
 * @param {string | null} screenName - Имя экрана ('pre-call-check', 'pre-call', 'call') или null для скрытия всех.
 */
export function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (screenName) {
        document.getElementById(`${screenName}-screen`).classList.add('active');
    }
}

/**
 * Показывает или скрывает модальное окно.
 * @param {string} modalName - Имя модального окна ('incoming-call', 'instructions').
 * @param {boolean} show - true для показа, false для скрытия.
 */
export function showModal(modalName, show) {
    const modal = document.getElementById(`${modalName}-modal`);
    if (modal) {
        modal.classList.toggle('active', show);
    }
}

/**
 * Показывает указанный popup на экране pre-call, скрывая остальные.
 * @param {string | null} popupName - Имя popup ('waiting', 'actions', 'initiating') или null для скрытия всех.
 */
export function showPopup(popupName) {
    document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
    if (popupName) {
        document.getElementById(`popup-${popupName}`).classList.add('active');
    }
}

/**
 * Сбрасывает таймер затухания UI на экране видеозвонка.
 */
function resetUiFade() {
    ui.callScreen.classList.add('ui-interactive');
    ui.callScreen.classList.remove('ui-faded');
    clearTimeout(uiFadeTimeout);
    uiFadeTimeout = setTimeout(() => ui.callScreen.classList.add('ui-faded'), 2000);
    setTimeout(() => ui.callScreen.classList.remove('ui-interactive'), 150);
}

/**
 * Добавляет обработчики событий для затухания UI в видеозвонке.
 */
export function setupVideoCallUiListeners() {
    ui.callScreen.addEventListener('mousemove', resetUiFade);
    ui.callScreen.addEventListener('click', resetUiFade);
    ui.callScreen.addEventListener('touchstart', resetUiFade);
}

/**
 * Удаляет обработчики событий для затухания UI.
 */
export function removeVideoCallUiListeners() {
    ui.callScreen.removeEventListener('mousemove', resetUiFade);
    ui.callScreen.removeEventListener('click', resetUiFade);
    ui.callScreen.removeEventListener('touchstart', resetUiFade);
}

/**
 * Обновляет UI звонка в зависимости от его типа (аудио/видео).
 * @param {string} callType - 'audio' или 'video'.
 * @param {object} targetUser - Объект с данными собеседника.
 * @param {object} mediaStatus - Статус доступа к медиа-устройствам.
 * @param {boolean} isMobile - Является ли устройство мобильным.
 */
export function updateCallUI(callType, targetUser, mediaStatus, isMobile) {
    ui.remoteUserName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    const isVideoCall = callType === 'video';
    
    ui.videoControlItem.style.display = isVideoCall && mediaStatus.hasCameraAccess ? 'flex' : 'none';
    ui.muteBtn.parentElement.style.display = mediaStatus.hasMicrophoneAccess ? 'flex' : 'none';
    ui.screenShareControlItem.style.display = isVideoCall && !isMobile ? 'flex' : 'none';
    
    ui.remoteVideo.style.display = isVideoCall ? 'block' : 'none';
    
    ui.callScreen.classList.toggle('video-call-active', isVideoCall);
    ui.callScreen.classList.toggle('audio-call-active', !isVideoCall);
}

/**
 * Сбрасывает элементы управления звонком в исходное состояние.
 */
export function resetCallControls() {
    ui.muteBtn.classList.remove('active');
    ui.videoBtn.classList.remove('active');
    ui.speakerBtn.classList.remove('active');
    ui.screenShareBtn.classList.remove('active');
    ui.localVideo.classList.remove('force-cover');
    ui.remoteVideo.classList.remove('force-cover');
    ui.toggleLocalViewBtn.querySelector('.icon').innerHTML = ICONS.localViewContain;
    ui.toggleRemoteViewBtn.querySelector('.icon').innerHTML = ICONS.remoteViewCover;
    clearTimeout(uiFadeTimeout);
    removeVideoCallUiListeners();
    ui.callScreen.classList.remove('ui-faded', 'ui-interactive', 'video-call-active', 'audio-call-active');
    ui.audioCallVisualizer.style.display = 'none';
    ui.remoteUserName.style.display = 'block';
}

/**
 * Запускает таймер длительности звонка.
 * @param {string} callType - 'audio' или 'video'.
 */
export function startTimer(callType) {
    ui.callScreen.classList.add('call-connected');
    if (callTimerInterval) clearInterval(callTimerInterval);
    let seconds = 0;
    ui.callTimer.textContent = '00:00';
    ui.remoteUserName.style.display = 'none';
    callTimerInterval = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        ui.callTimer.textContent = `${mins}:${secs}`;
    }, 1000);

    if (callType === 'video') {
        setupVideoCallUiListeners();
        resetUiFade();
    } else {
        ui.audioCallVisualizer.style.display = 'flex';
    }

    ui.connectionQuality.classList.add('active');
}

/**
 * Останавливает таймер длительности звонка.
 */
export function stopTimer() {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    ui.callTimer.textContent = '00:00';
    ui.remoteUserName.style.display = 'block';
}

/**
 * Обновляет UI для демонстрации экрана.
 * @param {boolean} isSharing - true, если демонстрация включена.
 * @param {boolean} isVideoEnabled - Включено ли видео у пользователя.
 * @param {string} callType - 'audio' или 'video'.
 */
export function updateScreenShareUI(isSharing, isVideoEnabled, callType) {
    ui.screenShareBtn.classList.toggle('active', isSharing);
    ui.localVideoContainer.style.display = isSharing ? 'none' : (isVideoEnabled && callType === 'video' ? 'flex' : 'none');
}

/**
 * Показывает всплывающее уведомление о статусе микрофона собеседника.
 * @param {boolean} isMuted - true, если микрофон выключен.
 */
export function showRemoteMuteToast(isMuted) {
    clearTimeout(remoteMuteToastTimeout);
    if (isMuted) {
        ui.remoteMuteToast.textContent = "Собеседник выключил микрофон. 🔇";
    } else {
        ui.remoteMuteToast.textContent = "Микрофон снова включён. 🎤";
    }
    ui.remoteMuteToast.classList.add('visible');
    remoteMuteToastTimeout = setTimeout(() => {
        ui.remoteMuteToast.classList.remove('visible');
    }, 2000);
}

/**
 * Показывает всплывающее уведомление о качестве соединения.
 * @param {string} type - 'good', 'warning', 'bad'.
 * @param {string} message - Текст уведомления.
 */
export function showConnectionToast(type, message) {
    clearTimeout(connectionToastTimeout);
    
    let finalMessage = message;
    if (type === 'good') {
        finalMessage += ' 🌍';
    } else if (type === 'warning') {
        finalMessage += ' 📡';
    }
    
    ui.connectionToast.textContent = finalMessage;
    ui.connectionToast.className = 'toast-notification'; // Reset classes
    ui.connectionToast.classList.add(`toast-${type}`);
    
    ui.connectionToast.classList.add('visible');
    
    connectionToastTimeout = setTimeout(() => {
        ui.connectionToast.classList.remove('visible');
    }, 2000);
}

/**
 * Обновляет иконку типа соединения.
 * @param {string} type - 'local', 'p2p', 'relay', 'unknown'.
 */
export function updateConnectionIcon(type) {
    ui.connectionStatus.querySelectorAll('.icon:not(#connection-quality)').forEach(icon => icon.classList.remove('active'));
    const typeMap = {
        local: { id: 'conn-local', title: 'Прямое локальное соединение (LAN)' },
        p2p: { id: 'conn-p2p', title: 'Прямое P2P соединение (Direct)' },
        relay: { id: 'conn-relay', title: 'Соединение через сервер (Relay)' },
        unknown: { id: 'conn-unknown', title: 'Определение типа соединения...' }
    };
    const { id, title } = typeMap[type] || typeMap.unknown;
    document.getElementById(id)?.classList.add('active');
    ui.connectionStatus.setAttribute('data-type-title', title);
    const qualityText = ui.connectionStatus.title.split(' / ')[0] || 'Качество соединения';
    ui.connectionStatus.title = `${qualityText} / ${title}`;
}

/**
 * Обновляет иконку качества соединения.
 * @param {string} quality - 'good', 'medium', 'bad', 'unknown'.
 */
export function updateConnectionQualityIcon(quality) {
    ui.connectionQuality.classList.remove('quality-good', 'quality-medium', 'quality-bad');
    [ui.qualityGoodSvg, ui.qualityMediumSvg, ui.qualityBadSvg].forEach(svg => {
        svg.classList.remove('active-quality-svg');
        svg.style.display = 'none';
    });
    const qualityMap = {
        good: { class: 'quality-good', text: 'Отличное соединение', svg: ui.qualityGoodSvg },
        medium: { class: 'quality-medium', text: 'Среднее соединение', svg: ui.qualityMediumSvg },
        bad: { class: 'quality-bad', text: 'Плохое соединение', svg: ui.qualityBadSvg },
        unknown: { class: '', text: 'Оценка качества...', svg: null }
    };
    const { class: qualityClass, text: qualityText, svg: activeSvg } = qualityMap[quality] || qualityMap.unknown;
    if (qualityClass) ui.connectionQuality.classList.add(qualityClass);
    if (activeSvg) {
        activeSvg.style.display = 'block';
        activeSvg.classList.add('active-quality-svg');
    }
    const typeTitle = ui.connectionStatus.getAttribute('data-type-title') || 'Определение типа...';
    ui.connectionStatus.title = `${qualityText} / ${typeTitle}`;
}

/**
 * Показывает всплывающую подсказку с деталями соединения.
 */
export function showConnectionInfo() {
    const details = monitor.getCurrentConnectionDetails();
    if (!details) return;
    clearTimeout(infoPopupTimeout);
    ui.connectionInfoPopup.textContent = `${details.region}, ${details.provider}`;
    ui.connectionInfoPopup.classList.add('active');
    infoPopupTimeout = setTimeout(() => {
        ui.connectionInfoPopup.classList.remove('active');
    }, 3000);
}

/**
 * Останавливает звук входящего звонка.
 */
export function stopIncomingRing() {
    ui.ringInAudio.pause();
    ui.ringInAudio.currentTime = 0;
}