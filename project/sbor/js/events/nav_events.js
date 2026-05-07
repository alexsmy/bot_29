import { els } from '../state.js';
import { switchStep } from '../ui_core.js';
import { openSettings, closeSettings } from '../ui/render_settings.js';
import { applySettings } from '../file_processor.js';

export function setupNavEvents() {
    if (els.btnBackFinal) {
        els.btnBackFinal.addEventListener('click', () => switchStep(1));
    }

    if (els.btnBackReview) {
        els.btnBackReview.addEventListener('click', () => switchStep(2));
    }

    if (els.btnBackSecrets) {
        els.btnBackSecrets.addEventListener('click', () => switchStep(3));
    }

    if (els.btnOpenSettings) {
        els.btnOpenSettings.addEventListener('click', openSettings);
    }

    if (els.btnSettingsExc) {
        els.btnSettingsExc.addEventListener('click', openSettings);
    }

    if (els.btnSettingsFinal) {
        els.btnSettingsFinal.addEventListener('click', openSettings);
    }

    if (els.btnCloseSettings) {
        els.btnCloseSettings.addEventListener('click', closeSettings);
    }

    if (els.overlay) {
        els.overlay.addEventListener('click', () => {
            closeSettings();
        });
    }

    if (els.btnApplySettings) {
        els.btnApplySettings.addEventListener('click', () => {
            const allControls = els.modalSettings.querySelectorAll('input, select');
            applySettings(allControls);
        });
    }
}
