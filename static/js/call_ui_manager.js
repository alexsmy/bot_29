
import {
    preCallCheckScreen, preCallScreen, callScreen, instructionsModal, deviceSettingsModal,
    incomingCallModal, popupWaiting, popupActions, popupInitiating,
    cameraStatus, cameraStatusText, micStatus, micStatusText, continueSpectatorBtn,
    remoteUserName, callTimer, videoControlItem, muteBtn, screenShareBtn,
    remoteVideo, localVideoContainer, audioCallVisualizer, connectionStatus,
    connectionQuality, qualityGoodSvg, qualityMediumSvg, qualityBadSvg,
    remoteMuteToast, connectionToast, connectionInfoPopup,
    localVideo, localAudio, toggleLocalViewBtn, toggleRemoteViewBtn,
    callingOverlay, callingOverlayTitle, lifetimeTimer,
    ringOutAudio, connectAudio, ringInAudio,
    cameraSelectCall, micSelectCall, speakerSelectCall,
    cameraSelectContainerCall, micSelectContainerCall, speakerSelectContainerCall,
    closeInstructionsBtns, closeSettingsBtns
} from './call_ui_elements.js';

let uiFadeTimeout = null;
let remoteMuteToastTimeout = null;
let connectionToastTimeout = null;
let infoPopupTimeout = null;

export function getLocalVideoElement() { return localVideo; }
export function getRemoteVideoElement() { return remoteVideo; }
export function getLocalAudioElement() { return localAudio; }

export function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (screenName) document.getElementById(`${screenName}-screen`).classList.add('active');
}

export function showModal(modalName, show) {
    const modal = document.getElementById(`${modalName}-modal`);
    if (modal) modal.classList.toggle('active', show);
}

export function showPreCallPopup(popupName) {
    document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
    if (popupName) document.getElementById(`popup-${popupName}`).classList.add('active');
}

export function showCallingOverlay(show, callType = 'audio') {
    if (show) {
        const title = callType === 'video' ? 'Видеовызов...' : 'Аудиовызов...';
        callingOverlayTitle.textContent = title;
        callingOverlay.classList.add('active');
    } else {
        callingOverlay.classList.remove('active');
    }
}

export function showIncomingCall(caller, type) {
    document.getElementById('caller-name').textContent = caller;
    document.getElementById('incoming-call-type').textContent = type === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок';
    showModal('incoming-call', true);
}

export function updateStatusIndicators(hasCamera, hasMic) {
    cameraStatus.classList.toggle('status-ok', hasCamera);
    cameraStatus.classList.toggle('status-error', !hasCamera);
    cameraStatusText.textContent = `Камера: ${hasCamera ? 'OK' : 'Нет доступа'}`;

    micStatus.classList.toggle('status-ok', hasMic);
    micStatus.classList.toggle('status-error', !hasMic);
    micStatusText.textContent = `Микрофон: ${hasMic ? 'OK' : 'Нет доступа'}`;
}

export function displayMediaErrors() {
    continueSpectatorBtn.style.display = 'block';
}

export function updateCallUI(callType, targetUser, mediaStatus, isMobile) {
    remoteUserName.textContent = `${targetUser?.first_name || 'Собеседник'}`;
    const isVideoCall = callType === 'video';
    const { hasCameraAccess, hasMicrophoneAccess } = mediaStatus;

    videoControlItem.style.display = isVideoCall && hasCameraAccess ? 'flex' : 'none';
    muteBtn.parentElement.style.display = hasMicrophoneAccess ? 'flex' : 'none';
    document.getElementById('screen-share-control-item').style.display = isVideoCall && !isMobile ? 'flex' : 'none';

    remoteVideo.style.display = isVideoCall ? 'block' : 'none';

    callScreen.classList.toggle('video-call-active', isVideoCall);
    callScreen.classList.toggle('audio-call-active', !isVideoCall);
}

export function cleanupAfterCall() {
    stopAudio('ringOut');
    stopAudio('ringIn');
    stopCallTimer();
    showModal('incoming-call', false);
    showCallingOverlay(false);
    showScreen('pre-call');
    resetCallControls();
    connectionQuality.classList.remove('active');
    document.getElementById('remote-audio-level').style.display = 'none';
    localAudio.srcObject = null;
    localVideo.srcObject = null;
    localVideoContainer.style.display = 'none';
    remoteVideo.style.display = 'none';
}

export function resetCallControls() {
    muteBtn.classList.remove('active');
    videoControlItem.querySelector('#video-btn').classList.remove('active');
    document.getElementById('speaker-btn').classList.remove('active');
    screenShareBtn.classList.remove('active');
    
    localVideo.classList.remove('force-cover');
    remoteVideo.classList.remove('force-cover');
    
    if (typeof ICONS !== 'undefined') {
        toggleLocalViewBtn.querySelector('.icon').innerHTML = ICONS.localViewContain;
        toggleRemoteViewBtn.querySelector('.icon').innerHTML = ICONS.remoteViewCover;
    }

    clearTimeout(uiFadeTimeout);
    removeVideoCallUiListeners();
    callScreen.classList.remove('ui-faded', 'ui-interactive', 'video-call-active', 'audio-call-active', 'call-connected');
    audioCallVisualizer.style.display = 'none';
    remoteUserName.style.display = 'block';
}

export function updateMuteButton(isMuted) {
    muteBtn.classList.toggle('active', isMuted);
}

export function updateSpeakerButton(isMuted) {
    document.getElementById('speaker-btn').classList.toggle('active', isMuted);
}

export function updateVideoButton(isVideoEnabled) {
    videoControlItem.querySelector('#video-btn').classList.toggle('active', !isVideoEnabled);
}

export function setLocalVideoVisibility(visible) {
    localVideoContainer.style.display = visible ? 'flex' : 'none';
}

export function updateScreenShareUI(isSharing, isVideoEnabled, currentCallType) {
    screenShareBtn.classList.toggle('active', isSharing);
    localVideoContainer.style.display = isSharing ? 'none' : (isVideoEnabled && currentCallType === 'video' ? 'flex' : 'none');
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

export function startCallTimer(callType, onTick) {
    callScreen.classList.add('call-connected');
    remoteUserName.style.display = 'none';
    
    if (callType === 'video') {
        setupVideoCallUiListeners();
        resetUiFade();
    } else {
        audioCallVisualizer.style.display = 'flex';
    }
    
    return setInterval(() => onTick(), 1000);
}

export function stopCallTimer(intervalId) {
    if (intervalId) clearInterval(intervalId);
    callTimer.textContent = '00:00';
    remoteUserName.style.display = 'block';
}

export function updateTimerDisplay(seconds) {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    callTimer.textContent = `${mins}:${secs}`;
}

export function updateRoomLifetimeUI(remainingSeconds) {
    if (remainingSeconds <= 0) {
        lifetimeTimer.textContent = "00:00";
        return false;
    }
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    lifetimeTimer.textContent = `${String(hours).padStart(2, '0')} ч. ${String(minutes).padStart(2, '0')} м.`;
    return true;
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

export function showConnectionToast(type, message) {
    clearTimeout(connectionToastTimeout);
    connectionToast.textContent = message;
    connectionToast.className = 'toast-notification';
    connectionToast.classList.add(`toast-${type}`);
    connectionToast.classList.add('visible');
    connectionToastTimeout = setTimeout(() => {
        connectionToast.classList.remove('visible');
    }, 2000);
}

export function handleRemoteMuteStatus(isMuted) {
    clearTimeout(remoteMuteToastTimeout);
    remoteMuteToast.textContent = isMuted ? "Собеседник выключил микрофон. 🔇" : "Микрофон снова включён. 🎤";
    remoteMuteToast.classList.add('visible');
    remoteMuteToastTimeout = setTimeout(() => {
        remoteMuteToast.classList.remove('visible');
    }, 2000);
}

export function playAudio(type) {
    const audioMap = { ringOut: ringOutAudio, ringIn: ringInAudio, connect: connectAudio };
    if (audioMap[type]) audioMap[type].play().catch(e => log(`Audio play failed: ${e}`));
}

export function stopAudio(type) {
    const audioMap = { ringOut: ringOutAudio, ringIn: ringInAudio };
    if (audioMap[type]) {
        audioMap[type].pause();
        audioMap[type].currentTime = 0;
    }
}

export function redirectToInvalidLink() {
    setGracefulDisconnect(true);
    window.location.reload();
}

export async function openDeviceSettings() {
    const populate = (select, devicesList, container, currentId) => {
        container.style.display = devicesList.length > 0 ? 'flex' : 'none';
        if (devicesList.length === 0) return;
        select.innerHTML = '';
        devicesList.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `${select.id} ${select.options.length + 1}`;
            if (device.deviceId === currentId) option.selected = true;
            select.appendChild(option);
        });
    };
    const devices = await navigator.mediaDevices.enumerateDevices();
    const localStream = media.getLocalStream();
    const currentAudioTrack = localStream?.getAudioTracks()[0];
    const currentVideoTrack = localStream?.getVideoTracks()[0];
    const { selectedAudioOutId } = stateManager.getState();
    populate(micSelectCall, devices.filter(d => d.kind === 'audioinput'), micSelectContainerCall, currentAudioTrack?.getSettings().deviceId);
    populate(cameraSelectCall, devices.filter(d => d.kind === 'videoinput'), cameraSelectContainerCall, currentVideoTrack?.getSettings().deviceId);
    populate(speakerSelectCall, devices.filter(d => d.kind === 'audiooutput'), speakerSelectContainerCall, selectedAudioOutId);
    showModal('device-settings', true);
}

export function setupGlobalEventHandlers() {
    closeInstructionsBtns.forEach(btn => btn.addEventListener('click', () => showModal('instructions', false)));
    closeSettingsBtns.forEach(btn => btn.addEventListener('click', () => showModal('device-settings', false)));

    connectionStatus.addEventListener('click', () => {
        const details = monitor.getCurrentConnectionDetails();
        showConnectionInfo(details);
    });

    let isDragging = false, hasMoved = false, dragStartX, offsetX, longPressTimer;
    const onDragStart = (e) => {
        if (e.type === 'touchstart' && e.touches.length > 1) return;
        hasMoved = false;
        const rect = localVideoContainer.getBoundingClientRect();
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        dragStartX = clientX;
        offsetX = clientX - rect.left;
        longPressTimer = setTimeout(() => { isDragging = true; localVideoContainer.classList.add('dragging'); }, 200);
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
            if (!isDragging) { isDragging = true; localVideoContainer.classList.add('dragging'); }
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
        if (!hasMoved && !e.target.closest('button')) localVideoContainer.classList.toggle('small');
        isDragging = false;
        localVideoContainer.classList.remove('dragging');
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);
    };
    localVideoContainer.addEventListener('mousedown', onDragStart);
    localVideoContainer.addEventListener('touchstart', onDragStart, { passive: true });

    toggleLocalViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        localVideo.classList.toggle('force-cover');
        toggleLocalViewBtn.querySelector('.icon').innerHTML = localVideo.classList.contains('force-cover') ? ICONS.localViewCover : ICONS.localViewContain;
    });
    toggleRemoteViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        remoteVideo.classList.toggle('force-cover');
        toggleRemoteViewBtn.querySelector('.icon').innerHTML = remoteVideo.classList.contains('force-cover') ? ICONS.remoteViewContain : ICONS.remoteViewCover;
    });
}