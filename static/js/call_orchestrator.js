import * as state from './call_state.js';
import * as uiManager from './call_ui_manager.js';
import * as media from './call_media.js';
import * as webrtc from './call_webrtc.js';
import * as monitor from './call_connection_monitor.js';
import * as preCallHandler from './handlers/pre_call_handler.js';
import * as lobbyHandler from './handlers/lobby_handler.js';
import * as inCallHandler from './handlers/in_call_handler.js';
import * as deviceHandler from './handlers/device_handler.js';
import { log } from './call_logger.js';
import {
    instructionsBtn, deviceSettingsBtn,
    cameraSelectCall, micSelectCall, speakerSelectCall,
    toggleLocalViewBtn, toggleRemoteViewBtn, connectionStatus
} from './call_ui_elements.js';

function setupGlobalEventListeners() {
    instructionsBtn.addEventListener('click', () => uiManager.showModal('instructions', true));
    document.querySelectorAll('.close-instructions-btn').forEach(btn => btn.addEventListener('click', () => uiManager.showModal('instructions', false)));
    
    deviceSettingsBtn.addEventListener('click', () => uiManager.openDeviceSettingsModal(media.getLocalStream(), state.getState()));
    document.querySelectorAll('.close-settings-btn').forEach(btn => btn.addEventListener('click', () => uiManager.showModal('device-settings', false)));
    
    cameraSelectCall.addEventListener('change', (e) => deviceHandler.switchInputDevice('video', e.target.value));
    micSelectCall.addEventListener('change', (e) => deviceHandler.switchInputDevice('audio', e.target.value));
    speakerSelectCall.addEventListener('change', (e) => deviceHandler.switchAudioOutput(e.target.value));

    toggleLocalViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiManager.toggleLocalVideoView();
    });
    toggleRemoteViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiManager.toggleRemoteVideoView();
    });
    connectionStatus.addEventListener('click', () => {
        const details = monitor.getCurrentConnectionDetails();
        uiManager.showConnectionInfo(details);
    });
    uiManager.setupLocalVideoInteraction();
}

export function initialize(roomId, rtcConfig, iceServerDetails, isRecordingEnabled, role) {
    log('APP_LIFECYCLE', `Initializing for room: ${roomId}, Role: ${role}`);
    state.setRoomId(roomId);
    state.setRtcConfig(rtcConfig);
    state.setIceServerDetails(iceServerDetails);
    state.setIsRecordingEnabled(isRecordingEnabled);
    state.setRole(role);

    media.init(log);
    
    monitor.init({
        log: log,
        getPeerConnection: webrtc.getPeerConnection,
        updateConnectionIcon: uiManager.updateConnectionIcon,
        updateConnectionQualityIcon: uiManager.updateConnectionQualityIcon,
        showConnectionToast: uiManager.showConnectionToast,
        getIceServerDetails: () => state.getState().iceServerDetails,
        onConnectionEstablished: (type) => {
            sendMessage({ type: 'connection_established', data: { type: type } });
        }
    });

    webrtc.init({
        log: log,
        onCallConnected: inCallHandler.onCallConnected,
        onCallEndedByPeer: (reason) => inCallHandler.endCall(false, reason),
        onRemoteTrack: (stream) => media.visualizeRemoteMic(stream),
        onRemoteMuteStatus: uiManager.handleRemoteMuteStatus,
        getTargetUser: () => state.getState().targetUser,
        getSelectedAudioOutId: () => state.getState().selectedAudioOutId,
        getCurrentConnectionType: monitor.getCurrentConnectionType,
        isVideoEnabled: () => state.getState().isVideoEnabled,
    });

    preCallHandler.init(lobbyHandler.enterLobby);
    lobbyHandler.init();
    inCallHandler.init();
    
    setupGlobalEventListeners();
    
    preCallHandler.runPreCallCheck();
}