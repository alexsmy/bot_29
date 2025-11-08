
// static/js/call_state.js 51_2

// Этот модуль централизует все состояние приложения.
// Вместо множества let-переменных в main.js, мы храним все здесь.

const state = {
    currentUser: {},
    targetUser: {},
    currentCallType: 'audio',
    isSpeakerMuted: false,
    isMuted: false,
    isVideoEnabled: true,
    isSpectator: false,
    isCallInitiator: false,
    isEndingCall: false,
    
    // ID устройств
    selectedVideoId: null,
    selectedAudioInId: null,
    selectedAudioOutId: null,

    // Техническое состояние
    roomId: '',
    rtcConfig: null,
    iceServerDetails: {},

    // Таймеры
    callTimerInterval: null,
    lifetimeTimerInterval: null,
};

// Функции для получения доступа к состоянию (геттеры)
export function getState() {
    return state;
}

export function getCurrentUser() { return state.currentUser; }
export function getTargetUser() { return state.targetUser; }
export function getRoomId() { return state.roomId; }
export function getRtcConfig() { return state.rtcConfig; }
export function getIceServerDetails() { return state.iceServerDetails; }
export function getSelectedAudioOutId() { return state.selectedAudioOutId; }
export function isVideoOn() { return state.isVideoEnabled; }


// Функции для изменения состояния (сеттеры)
// Использование сеттеров делает изменение состояния предсказуемым и управляемым.

export function setCurrentUser(user) { state.currentUser = user; }
export function setTargetUser(user) { state.targetUser = user; }
export function setCurrentCallType(type) { state.currentCallType = type; }
export function setIsSpeakerMuted(muted) { state.isSpeakerMuted = muted; }
export function setIsMuted(muted) { state.isMuted = muted; }
export function setIsVideoEnabled(enabled) { state.isVideoEnabled = enabled; }
export function setIsSpectator(spectator) { state.isSpectator = spectator; }
export function setIsCallInitiator(initiator) { state.isCallInitiator = initiator; }
export function setIsEndingCall(ending) { state.isEndingCall = ending; }

export function setSelectedVideoId(id) { state.selectedVideoId = id; }
export function setSelectedAudioInId(id) { state.selectedAudioInId = id; }
export function setSelectedAudioOutId(id) { state.selectedAudioOutId = id; }

export function setRoomId(id) { state.roomId = id; }
export function setRtcConfig(config) { state.rtcConfig = config; }
export function setIceServerDetails(details) { state.iceServerDetails = details; }

export function setCallTimerInterval(interval) { state.callTimerInterval = interval; }
export function setLifetimeTimerInterval(interval) { state.lifetimeTimerInterval = interval; }

export function resetCallState() {
    state.isMuted = false;
    state.isVideoEnabled = true;
    state.isSpeakerMuted = false;
    state.isEndingCall = false;
    state.targetUser = {};
    if (state.callTimerInterval) {
        clearInterval(state.callTimerInterval);
        state.callTimerInterval = null;
    }
}