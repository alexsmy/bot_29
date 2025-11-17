import * as state from '../call_state.js';
import * as uiManager from '../call_ui_manager.js';
import * as media from '../call_media.js';
import { log } from '../call_logger.js';
import {
    previewVideo, micLevelBars, continueToCallBtn, cameraSelect, micSelect, speakerSelect,
    cameraSelectContainer, micSelectContainer, speakerSelectContainer
} from '../call_ui_elements.js';

let onProceedCallback = () => {};

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

async function updatePreviewStream() {
    state.setSelectedVideoId(cameraSelect.value);
    state.setSelectedAudioInId(micSelect.value);
    state.setSelectedAudioOutId(speakerSelect.value);
    const { hasCameraAccess, hasMicrophoneAccess } = media.getMediaAccessStatus();
    const constraints = {
        audio: hasMicrophoneAccess ? { deviceId: { exact: state.getState().selectedAudioInId } } : false,
        video: hasCameraAccess ? { deviceId: { exact: state.getState().selectedVideoId } } : false
    };
    await media.updatePreviewStream(constraints, previewVideo, micLevelBars);
}

export async function runPreCallCheck() {
    uiManager.showScreen('pre-call-check');
    if (isIOS()) {
        document.getElementById('ios-audio-permission-note').style.display = 'block';
    }
    const { hasCameraAccess, hasMicrophoneAccess } = await media.initializePreview(previewVideo, micLevelBars);
    if (!hasCameraAccess || !hasMicrophoneAccess) {
        uiManager.displayMediaErrors({ name: 'NotFoundError' });
    }
    uiManager.updateStatusIndicators(hasCameraAccess, hasMicrophoneAccess);
    if (hasCameraAccess || hasMicrophoneAccess) {
        const selectedIds = await media.populateDeviceSelectors(
            cameraSelect, micSelect, speakerSelect,
            cameraSelectContainer, micSelectContainer, speakerSelectContainer
        );
        state.setSelectedVideoId(selectedIds.videoId);
        state.setSelectedAudioInId(selectedIds.audioInId);
        state.setSelectedAudioOutId(selectedIds.audioOutId);
        continueToCallBtn.disabled = false;
    } else {
        log('MEDIA_DEVICES', 'No media devices available or access denied to all.');
    }
}

function proceedToCall(asSpectator = false) {
    state.setIsSpectator(asSpectator);
    media.stopPreviewStream();
    onProceedCallback();
}

export function init(onProceed) {
    onProceedCallback = onProceed;
    continueToCallBtn.addEventListener('click', () => proceedToCall(false));
    document.getElementById('continue-spectator-btn').addEventListener('click', () => proceedToCall(true));
    cameraSelect.addEventListener('change', updatePreviewStream);
    micSelect.addEventListener('change', updatePreviewStream);
    speakerSelect.addEventListener('change', updatePreviewStream);
}