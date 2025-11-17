const state = {
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
    isRecordingEnabled: false,
    localRecordingChunkIndex: 0,
    isCallConnected: false,
    roomType: 'private',
    isAutoAnswerDevice: false,
};

export function getState() {
    return state;
}

export function setCurrentUser(user) { state.currentUser = user; }
export function setTargetUser(user) { state.targetUser = user; }
export function setCurrentCallType(type) { state.currentCallType = type; }
export function setCallTimerInterval(interval) { state.callTimerInterval = interval; }
export function setLifetimeTimerInterval(interval) { state.lifetimeTimerInterval = interval; }
export function setIsSpeakerMuted(muted) { state.isSpeakerMuted = muted; }
export function setIsMuted(muted) { state.isMuted = muted; }
export function setIsVideoEnabled(enabled) { state.isVideoEnabled = enabled; }
export function setIsSpectator(spectator) { state.isSpectator = spectator; }
export function setRoomId(id) { state.roomId = id; }
export function setRtcConfig(config) { state.rtcConfig = config; }
export function setSelectedVideoId(id) { state.selectedVideoId = id; }
export function setSelectedAudioInId(id) { state.selectedAudioInId = id; }
export function setSelectedAudioOutId(id) { state.selectedAudioOutId = id; }
export function setIceServerDetails(details) { state.iceServerDetails = details; }
export function setIsCallInitiator(initiator) { state.isCallInitiator = initiator; }
export function setIsEndingCall(ending) { state.isEndingCall = ending; }
export function setIsRecordingEnabled(enabled) { state.isRecordingEnabled = enabled; }
export function setLocalRecordingChunkIndex(index) { state.localRecordingChunkIndex = index; }
export function incrementLocalRecordingChunkIndex() { state.localRecordingChunkIndex++; }
export function setIsCallConnected(connected) { state.isCallConnected = connected; }
export function setRoomType(type) { state.roomType = type; }
export function setIsAutoAnswerDevice(isAuto) { state.isAutoAnswerDevice = isAuto; }


export function resetCallState() {
    setIsMuted(false);
    setIsVideoEnabled(true);
    setIsSpeakerMuted(false);
    setIsEndingCall(false);
    setTargetUser({});
    setLocalRecordingChunkIndex(0);
    setIsCallConnected(false);
}