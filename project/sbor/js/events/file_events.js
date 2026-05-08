import { els, state } from '../state.js';
import { resetUI, switchStep } from '../ui_core.js';
import { processFolder, applyExclusions } from '../file_processor.js';

export function resetApp(skipStatus = false) {
    els.modalExclusions.style.display = 'none';
    els.modalFinal.style.display = 'none';
    if (els.modalReview) els.modalReview.style.display = 'none';
    els.modalSecrets.style.display = 'none';
    if (els.modalFinalization) els.modalFinalization.style.display = 'none';
    if (els.modalSave) els.modalSave.style.display = 'none';
    els.modalSettings.style.display = 'none';
    els.overlay.style.display = 'none';
    resetUI();
    els.folderInput.value = '';
    state.allFiles =[];
    state.structureString = '';
    state.excludedFiles =[];
    state.acceptedFiles =[];
    state.allExtensions.clear();
    state.fileContents =[];
    state.detectedSecrets =[];
    state.gitIgnoreRules =[];
    state.gitIgnoreSource = '';
    state.finalSelectedPaths = new Set();
    state.exclusionSelectedPaths = new Set();
    state.smartFilter.lastResult = null;
    state.smartFilter.seedFiles.clear();
    state.smartFilter.seedFolders.clear();
    state.secretReview = { excludedFiles: new Set(), filesWithFindings: new Map(), summary: null };
    state.saveResult = null;
    if (!skipStatus) {
        els.statusArea.textContent = 'Отменено.';
        els.statusArea.style.display = 'block';
    }
    state.currentStep = 0;
}

export function setupFileEvents() {
    els.folderInput.addEventListener('change', (e) => processFolder(Array.from(e.target.files)));

    els.btnCancelExc.addEventListener('click', () => resetApp());

    els.btnNextExc.addEventListener('click', () => {
        const rescuedPaths = new Set(state.exclusionSelectedPaths);
        applyExclusions(rescuedPaths);

        els.searchFin.value = '';
        state.searchQuerySmart = '';
        state.smartFilter.lastResult = null;
        switchStep(2);
    });
}
