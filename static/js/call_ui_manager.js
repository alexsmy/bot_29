// static/js/call_ui_manager.js

import * as uiElements from './call_ui_elements.js';
import { ICONS } from './icons_loader.js'; // Мы вынесем ICONS в отдельный файл для чистоты

let uiHandlers = {};
let callTimerInterval;
let uiFadeTimeout = null;
let infoPopupTimeout = null;
let remoteMuteToastTimeout = null;

export function init(handlers) {
    uiHandlers = handlers;
    _loadIcons();
    _setupEventListeners();
}

function _loadIcons() {
    const iconPlaceholders = document.querySelectorAll('[data-icon-name]');
    if (typeof ICONS === 'undefined') {
        console.error('ICONS object is not defined.');
        return;
    }
    iconPlaceholders.forEach(placeholder => {
        const iconName = placeholder.dataset.iconName;
        if (ICONS[iconName]) {
            placeholder.innerHTML = ICONS[iconName];
        }
    });
}

function _setupEventListeners() {
    uiElements.continueToCallBtn.addEventListener('click', () => uiHandlers.onProceedToCall(false));
    uiElements.continueSpectatorBtn.addEventListener('click', () => uiHandlers.onProceedToCall(true));
    uiElements.cameraSelect.addEventListener('change', uiHandlers.onUpdatePreviewStream);
    uiElements.micSelect.addEventListener('change', uiHandlers.onUpdatePreviewStream);
    uiElements.speakerSelect.addEventListener('change', uiHandlers.onUpdatePreviewStream);

    uiElements.speakerBtn.addEventListener('click', uiHandlers.onToggleSpeaker);
    uiElements.muteBtn.addEventListener('click', uiHandlers.onToggleMute);
    uiElements.videoBtn.addEventListener('click', uiHandlers.onToggleVideo);
    uiElements.screenShareBtn.addEventListener('click', uiHandlers.onToggleScreenShare);
    uiElements.acceptBtn.addEventListener('click', uiHandlers.onAcceptCall);
    uiElements.declineBtn.addEventListener('click', uiHandlers.onDeclineCall);
    
    uiElements.hangupBtn.addEventListener('click', () => uiHandlers.onEndCall(true, 'cancelled_by_user'));
    
    uiElements.closeSessionBtn.addEventListener('click', uiHandlers.onCloseSession);

    uiElements.instructionsBtn.addEventListener('click', () => uiElements.instructionsModal.classList.add('active'));
    uiElements.closeInstructionsBtns.forEach(btn => btn.addEventListener('click', () => uiElements.instructionsModal.classList.remove('active')));

    uiElements.deviceSettingsBtn.addEventListener('click', uiHandlers.onOpenDeviceSettings);
    uiElements.closeSettingsBtns.forEach(btn => btn.addEventListener('click', () => uiElements.deviceSettingsModal.classList.remove('active')));
    uiElements.cameraSelectCall.addEventListener('change', (e) => uiHandlers.onSwitchInputDevice('video', e.target.value));
    uiElements.micSelectCall.addEventListener('change', (e) => uiHandlers.onSwitchInputDevice('audio', e.target.value));
    uiElements.speakerSelectCall.addEventListener('change', (e) => uiHandlers.onSwitchAudioOutput(e.target.value));

    uiElements.popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        if (button) {
            uiHandlers.onInitiateCall(button.dataset.callType);
        }
    });

    uiElements.toggleLocalViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiElements.localVideo.classList.toggle('force-cover');
        const iconSpan = uiElements.toggleLocalViewBtn.querySelector('.icon');
        iconSpan.innerHTML = uiElements.localVideo.classList.contains('force-cover') ? ICONS.localViewCover : ICONS.localViewContain;
    });

    uiElements.toggleRemoteViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiElements.remoteVideo.classList.toggle('force-cover');
        const iconSpan = uiElements.toggleRemoteViewBtn.querySelector('.icon');
        iconSpan.innerHTML = uiElements.remoteVideo.classList.contains('force-cover') ? ICONS.remoteViewContain : ICONS.remoteViewCover;
    });

    uiElements.connectionStatus.addEventListener('click', uiHandlers.onShowConnectionInfo);

    _setupLocalVideoInteraction();
}

function _setupLocalVideoInteraction() {
    let isDragging = false, hasMoved = false, dragStartX, offsetX, longPressTimer;

    const onDragStart = (e) => {
        if (e.type === 'touchstart' && e.touches.length > 1) return;
        hasMoved = false;
        const rect = uiElements.localVideoContainer.getBoundingClientRect();
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        dragStartX = clientX;
        offsetX = clientX - rect.left;
        longPressTimer = setTimeout(() => {
            isDragging = true;
            uiElements.localVideoContainer.classList.add('dragging');
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
                uiElements.localVideoContainer.classList.add('dragging');
            }
        }
        if (isDragging) {
            if (e.type === 'touchmove') e.preventDefault();
            let newLeft = clientX - offsetX;
            const parentWidth = uiElements.localVideoContainer.parentElement.clientWidth;
            const videoWidth = uiElements.localVideoContainer.getBoundingClientRect().width;
            newLeft = Math.max(0, Math.min(newLeft, parentWidth - videoWidth));
            uiElements.localVideoContainer.style.left = `${newLeft}px`;
        }
    };

    const onDragEnd = (e) => {
        clearTimeout(longPressTimer);
        if (!hasMoved && !e.target.closest('button')) {
            uiElements.localVideoContainer.classList.toggle('small');
        }
        isDragging = false;
        uiElements.localVideoContainer.classList.remove('dragging');
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);
    };

    uiElements.localVideoContainer.addEventListener('mousedown', onDragStart);
    uiElements.localVideoContainer.addEventListener('touchstart', onDragStart, { passive: true });
}

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

export function updateStatusIndicators(hasCamera, hasMic) {
    uiElements.cameraStatus.classList.toggle('status-ok', hasCamera);
    uiElements.cameraStatus.classList.toggle('status-error', !hasCamera);
    uiElements.cameraStatusText.textContent = `Камера: ${hasCamera ? 'OK' : 'Нет доступа'}`;

    uiElements.micStatus.classList.toggle('status-ok', hasMic);
    uiElements.micStatus.classList.toggle('status-error', !hasMic);
    uiElements.micStatusText.textContent = `Микрофон: ${hasMic ? 'OK' : 'Нет доступа'}`;
}

export function updateCallUI(targetUser, callType, hasCameraAccess, hasMicrophoneAccess, isMobile) {
    uiElements.remoteUserName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    const isVideoCall = callType === 'video';
    
    uiElements.videoControlItem.style.display = isVideoCall && hasCameraAccess ? 'flex' : 'none';
    uiElements.muteBtn.parentElement.style.display = hasMicrophoneAccess ? 'flex' : 'none';
    uiElements.screenShareControlItem.style.display = isVideoCall && !isMobile ? 'flex' : 'none';
    uiElements.remoteVideo.style.display = isVideoCall ? 'block' : 'none';
    
    uiElements.callScreen.classList.toggle('video-call-active', isVideoCall);
    uiElements.callScreen.classList.toggle('audio-call-active', !isVideoCall);
}

export function updateIncomingCallModal(targetUser, callType) {
    uiElements.callerName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    uiElements.incomingCallType.textContent = callType === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок';
}

export function setCallStatusRinging() {
    uiElements.callTimer.textContent = "Вызов...";
}

export function startTimer() {
    uiElements.callScreen.classList.add('call-connected');
    if (callTimerInterval) clearInterval(callTimerInterval);
    let seconds = 0;
    uiElements.callTimer.textContent = '00:00';
    uiElements.remoteUserName.style.display = 'none';
    callTimerInterval = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        uiElements.callTimer.textContent = `${mins}:${secs}`;
    }, 1000);
}

export function stopTimer() {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    uiElements.callTimer.textContent = '00:00';
    uiElements.remoteUserName.style.display = 'block';
}

export function updateLifetimeTimer(remainingSeconds) {
     if (remainingSeconds <= 0) {
        uiElements.lifetimeTimer.textContent = "00:00";
        return false; // Indicate that time is up
    } else {
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        uiElements.lifetimeTimer.textContent = `${String(hours).padStart(2, '0')} ч. ${String(minutes).padStart(2, '0')} м.`;
        return true; // Indicate that time is remaining
    }
}

export function setLifetimeTimerError() {
    uiElements.lifetimeTimer.textContent = "Ошибка";
}

export function resetCallControls() {
    uiElements.muteBtn.classList.remove('active');
    uiElements.videoBtn.classList.remove('active');
    uiElements.speakerBtn.classList.remove('active');
    uiElements.screenShareBtn.classList.remove('active');
    uiElements.localVideo.classList.remove('force-cover');
    uiElements.remoteVideo.classList.remove('force-cover');
    uiElements.toggleLocalViewBtn.querySelector('.icon').innerHTML = ICONS.localViewContain;
    uiElements.toggleRemoteViewBtn.querySelector('.icon').innerHTML = ICONS.remoteViewCover;
    clearTimeout(uiFadeTimeout);
    _removeVideoCallUiListeners();
    uiElements.callScreen.classList.remove('ui-faded', 'ui-interactive', 'video-call-active', 'audio-call-active', 'call-connected');
    uiElements.audioCallVisualizer.style.display = 'none';
    uiElements.remoteUserName.style.display = 'block';
    if (uiElements.remoteAudioLevel) uiElements.remoteAudioLevel.style.display = 'none';
}

export function updateMuteButton(isMuted) {
    uiElements.muteBtn.classList.toggle('active', isMuted);
}

export function updateSpeakerButton(isMuted) {
    uiElements.speakerBtn.classList.toggle('active', isMuted);
}

export function updateVideoButton(isVideoEnabled) {
    uiElements.videoBtn.classList.toggle('active', !isVideoEnabled);
    uiElements.localVideoContainer.style.display = isVideoEnabled ? 'flex' : 'none';
}

export function updateScreenShareButton(isSharing, isVideoEnabled, callType) {
    uiElements.screenShareBtn.classList.toggle('active', isSharing);
    const showLocalVideo = !isSharing && isVideoEnabled && callType === 'video';
    uiElements.localVideoContainer.style.display = showLocalVideo ? 'flex' : 'none';
}

export function handleRemoteMuteStatus(isMuted) {
    clearTimeout(remoteMuteToastTimeout);
    if (isMuted) {
        uiElements.remoteMuteToast.textContent = "Собеседник выключил микрофон. 🔇";
        uiElements.remoteMuteToast.classList.add('visible');
        remoteMuteToastTimeout = setTimeout(() => {
            uiElements.remoteMuteToast.classList.remove('visible');
        }, 3000);
    } else {
        uiElements.remoteMuteToast.classList.remove('visible');
    }
}

export function showConnectionToast(type, message) {
    uiElements.connectionToast.textContent = message;
    uiElements.connectionToast.classList.remove('toast-good', 'toast-bad');
    uiElements.connectionToast.classList.add(`toast-${type}`);
    uiElements.connectionToast.classList.add('visible');
    setTimeout(() => {
        uiElements.connectionToast.classList.remove('visible');
    }, 7000);
}

export function showConnectionInfo(details) {
    if (!details) return;
    clearTimeout(infoPopupTimeout);
    uiElements.connectionInfoPopup.textContent = `${details.region}, ${details.provider}`;
    uiElements.connectionInfoPopup.classList.add('active');
    infoPopupTimeout = setTimeout(() => {
        uiElements.connectionInfoPopup.classList.remove('active');
    }, 3000);
}

export function updateConnectionIcon(type) {
    uiElements.connectionStatus.querySelectorAll('.icon:not(#connection-quality)').forEach(icon => icon.classList.remove('active'));
    const typeMap = {
        local: { id: 'conn-local', title: 'Прямое локальное соединение (LAN)' },
        p2p: { id: 'conn-p2p', title: 'Прямое P2P соединение (Direct)' },
        relay: { id: 'conn-relay', title: 'Соединение через сервер (Relay)' },
        unknown: { id: 'conn-unknown', title: 'Определение типа соединения...' }
    };
    const { id, title } = typeMap[type] || typeMap.unknown;
    document.getElementById(id)?.classList.add('active');
    uiElements.connectionStatus.setAttribute('data-type-title', title);
    const qualityText = uiElements.connectionStatus.title.split(' / ')[0] || 'Качество соединения';
    uiElements.connectionStatus.title = `${qualityText} / ${title}`;
}

export function updateConnectionQualityIcon(quality) {
    uiElements.connectionQuality.classList.remove('quality-good', 'quality-medium', 'quality-bad');
    [uiElements.qualityGoodSvg, uiElements.qualityMediumSvg, uiElements.qualityBadSvg].forEach(svg => {
        svg.classList.remove('active-quality-svg');
        svg.style.display = 'none';
    });
    const qualityMap = {
        good: { class: 'quality-good', text: 'Отличное соединение', svg: uiElements.qualityGoodSvg },
        medium: { class: 'quality-medium', text: 'Среднее соединение', svg: uiElements.qualityMediumSvg },
        bad: { class: 'quality-bad', text: 'Плохое соединение', svg: uiElements.qualityBadSvg },
        unknown: { class: '', text: 'Оценка качества...', svg: null }
    };
    const { class: qualityClass, text: qualityText, svg: activeSvg } = qualityMap[quality] || qualityMap.unknown;
    if (qualityClass) uiElements.connectionQuality.classList.add(qualityClass);
    if (activeSvg) {
        activeSvg.style.display = 'block';
        activeSvg.classList.add('active-quality-svg');
    }
    const typeTitle = uiElements.connectionStatus.getAttribute('data-type-title') || 'Определение типа...';
    uiElements.connectionStatus.title = `${qualityText} / ${typeTitle}`;
}

export function openDeviceSettingsModal() {
    uiElements.deviceSettingsModal.classList.add('active');
}

export function populateDeviceSelectorsInCall(devices, currentIds, sinkId) {
    const { videoDevices, audioInDevices, audioOutDevices } = devices;
    const { currentAudioTrackId, currentVideoTrackId } = currentIds;

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
    
    populate(uiElements.micSelectCall, audioInDevices, uiElements.micSelectContainerCall, currentAudioTrackId);
    populate(uiElements.cameraSelectCall, videoDevices, uiElements.cameraSelectContainerCall, currentVideoTrackId);
    populate(uiElements.speakerSelectCall, audioOutDevices, uiElements.speakerSelectContainerCall, sinkId);
}

function _resetUiFade() {
    uiElements.callScreen.classList.add('ui-interactive');
    uiElements.callScreen.classList.remove('ui-faded');
    clearTimeout(uiFadeTimeout);
    uiFadeTimeout = setTimeout(() => uiElements.callScreen.classList.add('ui-faded'), 2000);
    setTimeout(() => uiElements.callScreen.classList.remove('ui-interactive'), 150);
}

function _setupVideoCallUiListeners() {
    uiElements.callScreen.addEventListener('mousemove', _resetUiFade);
    uiElements.callScreen.addEventListener('click', _resetUiFade);
    uiElements.callScreen.addEventListener('touchstart', _resetUiFade);
}

function _removeVideoCallUiListeners() {
    uiElements.callScreen.removeEventListener('mousemove', _resetUiFade);
    uiElements.callScreen.removeEventListener('click', _resetUiFade);
    uiElements.callScreen.removeEventListener('touchstart', _resetUiFade);
}

export function setupCallUI(callType) {
    if (callType === 'video') {
        _setupVideoCallUiListeners();
        _resetUiFade();
    } else {
        uiElements.audioCallVisualizer.style.display = 'flex';
    }
    uiElements.connectionQuality.classList.add('active');
}