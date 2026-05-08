import { els } from '../state.js';
import { switchStep } from '../ui_core.js';
import { openSettings } from '../ui/render_settings.js';
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

    if (els.btnBackFinalization) {
        els.btnBackFinalization.addEventListener('click', () => switchStep(4));
    }

    if (els.btnNextSecrets) {
        els.btnNextSecrets.addEventListener('click', () => switchStep(5));
    }

    if (els.btnBackHub) {
        els.btnBackHub.addEventListener('click', () => {
            window.location.href = '/';
        });
    }

    if (els.btnNewBuild) {
        els.btnNewBuild.addEventListener('click', () => {
            window.location.reload();
        });
    }

    if (els.btnSettingsExc) els.btnSettingsExc.addEventListener('click', openSettings);
    if (els.btnSettingsFinal) els.btnSettingsFinal.addEventListener('click', openSettings);

    if (els.btnCloseSettings) {
        els.btnCloseSettings.addEventListener('click', () => {
            els.modalSettings.style.display = 'none';
        });
    }

    if (els.btnApplySettings) {
        els.btnApplySettings.addEventListener('click', () => {
            const allCheckboxes = els.modalSettings.querySelectorAll('input[type="checkbox"]');
            applySettings(allCheckboxes);
        });
    }
}
