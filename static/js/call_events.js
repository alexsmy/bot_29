import * as actions from './call_actions.js';
import * as uiManager from './call_ui_manager.js';
import * as webrtc from './call_webrtc.js';
import * as state from './call_state.js';
import * as media from './call_media.js';
import {
    continueToCallBtn, cameraSelect, micSelect, speakerSelect,
    popupActions, closeSessionBtn, instructionsBtn, acceptBtn, declineBtn, hangupBtn,
    speakerBtn, muteBtn, videoBtn, screenShareBtn, connectionStatus,
    toggleLocalViewBtn, toggleRemoteViewBtn, deviceSettingsBtn,
    cameraSelectCall, micSelectCall, speakerSelectCall
} from './call_ui_elements.js';

/**
 * Инициализирует все обработчики событий на странице.
 */
export function initEventHandlers() {
    // Экран проверки оборудования
    continueToCallBtn.addEventListener('click', () => actions.proceedToCall(false));
    document.getElementById('continue-spectator-btn').addEventListener('click', () => actions.proceedToCall(true));
    cameraSelect.addEventListener('change', actions.updatePreviewStream);
    micSelect.addEventListener('change', actions.updatePreviewStream);
    speakerSelect.addEventListener('change', actions.updatePreviewStream);

    // Экран ожидания
    closeSessionBtn.addEventListener('click', actions.closeSession);
    instructionsBtn.addEventListener('click', () => uiManager.showModal('instructions', true));
    document.querySelectorAll('.close-instructions-btn').forEach(btn => btn.addEventListener('click', () => uiManager.showModal('instructions', false)));
    popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        if (button && state.getState().targetUser.id) {
            actions.initiateCall(state.getState().targetUser, button.dataset.callType);
        }
    });

    // Модальное окно входящего звонка
    acceptBtn.addEventListener('click', actions.acceptCall);
    declineBtn.addEventListener('click', actions.declineCall);

    // Экран звонка
    hangupBtn.addEventListener('click', () => actions.endCall(true, 'cancelled_by_user'));
    speakerBtn.addEventListener('click', actions.toggleSpeaker);
    muteBtn.addEventListener('click', actions.toggleMute);
    videoBtn.addEventListener('click', actions.toggleVideo);
    screenShareBtn.addEventListener('click', () => webrtc.toggleScreenShare(media.getLocalStream(), (isSharing) => uiManager.updateScreenShareUI(isSharing, state.getState().isVideoEnabled, state.getState().currentCallType)));
    
    // Управление видео
    toggleLocalViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiManager.toggleLocalVideoView();
    });
    toggleRemoteViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiManager.toggleRemoteVideoView();
    });
    
    // Статус соединения
    connectionStatus.addEventListener('click', () => {
        const details = monitor.getCurrentConnectionDetails();
        uiManager.showConnectionInfo(details);
    });

    // Настройки устройств во время звонка
    deviceSettingsBtn.addEventListener('click', () => uiManager.openDeviceSettingsModal(media.getLocalStream(), state.getState()));
    document.querySelectorAll('.close-settings-btn').forEach(btn => btn.addEventListener('click', () => uiManager.showModal('device-settings', false)));
    cameraSelectCall.addEventListener('change', (e) => actions.switchInputDevice('video', e.target.value));
    micSelectCall.addEventListener('change', (e) => actions.switchInputDevice('audio', e.target.value));
    speakerSelectCall.addEventListener('change', (e) => actions.switchAudioOutput(e.target.value));

    // Инициализация перетаскивания локального видео
    uiManager.setupLocalVideoInteraction();
}