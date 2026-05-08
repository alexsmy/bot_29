import { els, state } from '../state.js';
import { resetUI, switchStep } from '../ui_core.js';
import { processFolder, applyExclusions } from '../file_processor.js';

export function resetApp() {
    if (els.modalExclusions) els.modalExclusions.style.display = 'none';
    if (els.modalFinal) els.modalFinal.style.display = 'none';
    if (els.modalReview) els.modalReview.style.display = 'none';
    if (els.modalSecrets) els.modalSecrets.style.display = 'none';
    if (els.modalFinalize) els.modalFinalize.style.display = 'none';
    if (els.modalResult) els.modalResult.style.display = 'none';
    if (els.modalSettings) els.modalSettings.style.display = 'none';
    if (els.overlay) els.overlay.style.display = 'none';
    resetUI();
    els.folderInput.value = '';
    state.allFiles = [];
    state.structureString = '';
    state.excludedFiles = [];
    state.acceptedFiles = [];
    state.allExtensions.clear();
    state.fileContents = [];
    state.detectedSecrets = [];
    state.gitIgnoreRules = [];
    state.gitIgnoreSource = '';
    state.finalSelectedPaths = new Set();
    state.exclusionSelectedPaths = new Set();
    state.smartFilter.lastResult = null;
    state.smartFilter.seedFiles.clear();
    state.smartFilter.seedFolders.clear();
    state.secretReview = { excludedFiles: new Set(), filesWithFindings: new Map(), summary: null };
    state.generationResult = null;
    els.statusArea.textContent = 'Отменено.';
    els.statusArea.style.display = 'block';
    state.currentStep = 0;
}

export function setupFileEvents() {
    els.folderInput.addEventListener('change', (e) => processFolder(Array.from(e.target.files)));

    els.btnCancelExc.addEventListener('click', resetApp);

    els.btnNextExc.addEventListener('click', () => {
        const rescuedPaths = new Set(state.exclusionSelectedPaths);
        applyExclusions(rescuedPaths);

        els.searchFin.value = '';
        state.searchQuerySmart = '';
        state.smartFilter.lastResult = null;
        switchStep(2);
    });
}
