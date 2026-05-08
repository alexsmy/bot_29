import { els } from '../state.js';
import { switchStep } from '../ui_core.js';
import { openSettings } from '../ui/render_settings.js';
import { applySettings } from '../file_processor.js';

export function setupNavEvents() {
    els.btnBackFinal.addEventListener('click', () => switchStep(1));

    if (els.btnBackReview) {
        els.btnBackReview.addEventListener('click', () => switchStep(2));
    }

    if (els.btnBackSecrets) {
        els.btnBackSecrets.addEventListener('click', () => switchStep(3));
    }

    if (els.btnNextSecrets) {
        els.btnNextSecrets.addEventListener('click', () => switchStep(5));
    }

    if (els.btnBackFinalize) {
        els.btnBackFinalize.addEventListener('click', () => switchStep(4));
    }


    els.btnSettingsExc.addEventListener('click', openSettings);
    els.btnSettingsFinal.addEventListener('click', openSettings);

    els.btnCloseSettings.addEventListener('click', () => {
        els.modalSettings.style.display = 'none';
    });

    els.btnApplySettings.addEventListener('click', () => {
        const allCheckboxes = els.modalSettings.querySelectorAll('input[type="checkbox"]');
        applySettings(allCheckboxes);
    });
}
