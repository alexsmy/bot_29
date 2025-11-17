import * as state from '../call_state.js';
import * as uiManager from '../call_ui_manager.js';
import * as webrtc from '../call_webrtc.js';
import * as media from '../call_media.js';
import { initializeWebSocket, sendMessage } from '../call_websocket.js';
import { log } from '../call_logger.js';
import { acceptCall, declineCall, startActiveCall, endCall } from './in_call_handler.js';
import { popupActions, acceptBtn, declineBtn } from '../call_ui_elements.js';

function redirectToInvalidLink() {
    window.location.reload();
}

function handleUserList(users) {
    const otherUsers = users.filter(u => u.id !== state.getState().currentUser.id);
    const currentRole = state.getState().role;

    if (otherUsers.length === 0) {
        state.setTargetUser({});
        if (currentRole === 'roll_in') {
            uiManager.showPopup('receiver-waiting');
        } else {
            uiManager.showPopup('waiting');
        }
    } else {
        state.setTargetUser(otherUsers[0]);
        if (state.getState().targetUser.status === 'busy') {
            uiManager.showPopup('initiating');
        } else {
            if (currentRole === 'roll_in') {
                uiManager.showPopup('receiver-waiting');
            } else {
                uiManager.showPopup('actions');
            }
        }
    }
}

function handleIncomingCall(data) {
    const s = state.getState();
    if (s.role === 'roll_in' || s.isAutoAnswerDevice) {
        log('CALL_FLOW', 'Auto-answering incoming call due to role or device setting.');
        state.setIsCallInitiator(false);
        state.setTargetUser(data.from_user);
        state.setCurrentCallType(data.call_type);
        acceptCall();
        return;
    }

    log('CALL_FLOW', `Incoming call from ${data.from_user?.id}, type: ${data.call_type}`);
    state.setIsCallInitiator(false);
    state.setTargetUser(data.from_user);
    state.setCurrentCallType(data.call_type);
    uiManager.showIncomingCall(data.from_user?.first_name || 'Собеседник', data.call_type);
}

async function updateRoomLifetime() {
    try {
        const response = await fetch(`/room/lifetime/${state.getState().roomId}`);
        if (!response.ok) throw new Error('Room not found or expired on server.');
        const data = await response.json();
        uiManager.updateLifetimeDisplay(data.remaining_seconds, () => {
            clearInterval(state.getState().lifetimeTimerInterval);
            alert("Время жизни ссылки истекло.");
            redirectToInvalidLink();
        });
    } catch (error) {
        log('APP_LIFECYCLE', `Error fetching lifetime: ${error.message}`);
        uiManager.updateLifetimeDisplay(-1);
        clearInterval(state.getState().lifetimeTimerInterval);
    }
}

export function enterLobby() {
    log('CALL_SESSION', `Entering lobby.`);
    uiManager.showScreen('pre-call');

    const currentRole = state.getState().role;
    if (currentRole === 'roll_in') {
        uiManager.showPopup('receiver-waiting');
    } else {
        uiManager.showPopup('waiting');
    }

    const wsHandlers = {
        onIdentity: (data) => {
            state.setCurrentUser({ id: data.id });
            state.setRoomType(data.room_type || 'private');
            state.setIsAutoAnswerDevice(data.is_first_in_special_room || false);
            
            log('APP_LIFECYCLE', `Identity assigned: ${state.getState().currentUser.id}, RoomType: ${state.getState().roomType}, Role: ${currentRole}`);

            if (state.getState().roomType === 'special') {
                uiManager.showSpecialModeLabel(true);
            }
            if (state.getState().isAutoAnswerDevice) {
                log('APP_LIFECYCLE', 'This device is set to auto-answer mode.');
            }
        },
        onUserList: handleUserList,
        onIncomingCall: handleIncomingCall,
        onCallAccepted: () => {
            uiManager.stopRingOutSound();
            const localStream = media.getLocalStream();
            webrtc.startPeerConnection(state.getState().targetUser.id, true, state.getState().currentCallType, localStream, state.getState().rtcConfig);
        },
        onOffer: (data) => {
            const localStream = media.getLocalStream();
            webrtc.handleOffer(data, localStream, state.getState().rtcConfig);
        },
        onAnswer: webrtc.handleAnswer,
        onCandidate: webrtc.handleCandidate,
        onCallEnded: () => endCall(false, 'ended_by_peer'),
        onCallMissed: () => {
            alert("Абонент не отвечает.");
            endCall(false, 'no_answer');
        },
        onRoomClosed: () => {
            alert("Комната для звонков была закрыта.");
            redirectToInvalidLink();
        },
        onFatalError: redirectToInvalidLink
    };
    initializeWebSocket(state.getState().roomId, wsHandlers, log);
    updateRoomLifetime();
    state.setLifetimeTimerInterval(setInterval(updateRoomLifetime, 60000));
}

export function init() {
    popupActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-call-btn');
        if (button && state.getState().targetUser.id) {
            startActiveCall(button.dataset.callType, state.getState().targetUser);
        }
    });
    acceptBtn.addEventListener('click', acceptCall);
    declineBtn.addEventListener('click', declineCall);
}