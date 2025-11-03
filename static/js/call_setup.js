
// static/js/call_setup.js

import * as media from './call_media.js';
import {
    previewVideo, micLevelBars, cameraStatus, cameraStatusText, micStatus, micStatusText,
    continueToCallBtn, continueSpectatorBtn, cameraSelect, micSelect, speakerSelect,
    cameraSelectContainer, micSelectContainer, speakerSelectContainer
} from './call_ui_elements.js';

let log = () => {};

/**
 * Проверяет, является ли текущее устройство устройством на базе iOS.
 * @returns {boolean}
 */
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function updateStatusIndicators(hasCamera, hasMic) {
    cameraStatus.classList.toggle('status-ok', hasCamera);
    cameraStatus.classList.toggle('status-error', !hasCamera);
    cameraStatusText.textContent = `Камера: ${hasCamera ? 'OK' : 'Нет доступа'}`;

    micStatus.classList.toggle('status-ok', hasMic);
    micStatus.classList.toggle('status-error', !hasMic);
    micStatusText.textContent = `Микрофон: ${hasMic ? 'OK' : 'Нет доступа'}`;
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
    console.error(message);
    // В будущем здесь можно будет показывать красивое уведомление
}

/**
 * Основная функция, выполняющая проверку оборудования перед звонком.
 * @returns {Promise<object>} Объект с ID выбранных устройств.
 */
export async function performPreCallChecks() {
    const iosNote = document.getElementById('ios-audio-permission-note');
    if (isIOS()) {
        iosNote.style.display = 'block';
    }

    const { hasCameraAccess, hasMicrophoneAccess } = await media.initializePreview(previewVideo, micLevelBars);

    if (!hasCameraAccess || !hasMicrophoneAccess) {
        displayMediaErrors({ name: 'NotFoundError' }); // Упрощенный вывод ошибки
        continueSpectatorBtn.style.display = 'block';
    }

    updateStatusIndicators(hasCameraAccess, hasMicrophoneAccess);

    let selectedIds = {
        videoId: null,
        audioInId: null,
        audioOutId: null
    };

    if (hasCameraAccess || hasMicrophoneAccess) {
        selectedIds = await media.populateDeviceSelectors(
            cameraSelect, micSelect, speakerSelect,
            cameraSelectContainer, micSelectContainer, speakerSelectContainer
        );
        continueToCallBtn.disabled = false;
    } else {
        log('[MEDIA_CHECK] No media devices available or access denied to all.');
    }

    return selectedIds;
}

/**
 * Обновляет превью-поток при смене устройства в выпадающем списке.
 */
export async function updatePreviewStream() {
    const selectedVideoId = cameraSelect.value;
    const selectedAudioInId = micSelect.value;
    
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();

    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: selectedAudioInId } } : false,
        video: hasCameraAccess ? { deviceId: { exact: selectedVideoId } } : false
    };

    await media.updatePreviewStream(constraints, previewVideo, micLevelBars);
}

/**
 * Инициализирует модуль, передавая ему функцию для логирования.
 * @param {Function} logger - Функция для вывода логов.
 */
export function init(logger) {
    log = logger;
}