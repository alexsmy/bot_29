import * as state from '../call_state.js';
import * as media from '../call_media.js';
import * as webrtc from '../call_webrtc.js';
import { log } from '../call_logger.js';
import { remoteVideo, remoteAudio } from '../call_ui_elements.js';

export async function switchInputDevice(kind, deviceId) {
    const localStream = media.getLocalStream();
    const newTrack = await webrtc.switchInputDevice(kind, deviceId, localStream);
    if (newTrack) {
        if (kind === 'video') {
            state.setSelectedVideoId(deviceId);
        } else {
            media.visualizeLocalMicForCall(localStream);
            state.setSelectedAudioInId(deviceId);
        }
    }
}

export async function switchAudioOutput(deviceId) {
    if (typeof remoteVideo.setSinkId !== 'function') {
        log('SINK_ID', 'setSinkId() is not supported by this browser.');
        alert('Ваш браузер не поддерживает переключение динамиков.');
        return;
    }
    try {
        await remoteVideo.setSinkId(deviceId);
        await remoteAudio.setSinkId(deviceId);
        state.setSelectedAudioOutId(deviceId);
        log('SINK_ID', `Audio output switched to deviceId: ${deviceId}`);
    } catch (error) {
        log('SINK_ID', `Error switching audio output: ${error}`);
        alert(`Не удалось переключить динамик: ${error.message}`);
    }
}