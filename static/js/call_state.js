let state = {};

const initialState = {
    currentUser: {},
    targetUser: {},
    currentCallType: 'audio',
    callTimerInterval: null,
    lifetimeTimerInterval: null,
    isSpeakerMuted: false,
    isMuted: false,
    isVideoEnabled: true,
    isSpectator: false,
    roomId: '',
    rtcConfig: null,
    selectedVideoId: null,
    selectedAudioInId: null,
    selectedAudioOutId: null,
    iceServerDetails: {},
    isCallInitiator: false,
    isEndingCall: false,
};

export function initializeState(initialData) {
    state = { ...initialState, ...initialData };
}

export function resetStateForNewCall() {
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

export function getState() {
    return state;
}

export function setState(newState) {
    state = { ...state, ...newState };
}