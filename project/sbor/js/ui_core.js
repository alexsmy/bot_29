import { els, state } from './state.js';
import { AI_MODELS } from './ai_models.js';
import { SMART_PROFILES } from './smart_filter.js';
import { renderExclusionsList, renderFinalizationStep, renderSaveStep, renderSmartStep, renderReviewList, renderSecretsList } from './ui_render.js';

export function initUI() {

    const loadSetting = (key, el, type = 'checkbox') => {
        const val = localStorage.getItem(key);
        if (val !== null) {
            if (type === 'checkbox') el.checked = val === 'true';
            else el.value = val;
        }
    };

    if (els.aiModelSelect) {
        els.aiModelSelect.innerHTML = '';
        AI_MODELS.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            els.aiModelSelect.appendChild(option);
        });

        const savedModel = localStorage.getItem('sbor_ai_model');
        if (savedModel) state.selectedAiModel = AI_MODELS.find(m => m.id === savedModel) || AI_MODELS[0];
        els.aiModelSelect.value = state.selectedAiModel.id;

        els.aiModelSelect.addEventListener('change', (e) => {
            state.selectedAiModel = AI_MODELS.find(m => m.id === e.target.value) || AI_MODELS[0];
            localStorage.setItem('sbor_ai_model', state.selectedAiModel.id);
        });
    }

    if (els.smartProfileSelect) {
        els.smartProfileSelect.innerHTML = '';
        SMART_PROFILES.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            option.title = profile.description;
            els.smartProfileSelect.appendChild(option);
        });
        els.smartProfileSelect.value = state.smartFilter.profileId;

        els.smartProfileSelect.addEventListener('change', (e) => {
            state.smartFilter.profileId = e.target.value;
            state.smartFilter.lastResult = null;
            renderSmartStep();
        });
    }

    if (els.cbSmartDeps) {
        els.cbSmartDeps.checked = state.smartFilter.autoAddDependencies;
        els.cbSmartDeps.addEventListener('change', (e) => {
            state.smartFilter.autoAddDependencies = e.target.checked;
            state.smartFilter.lastResult = null;
        });
    }

    if (els.cbSmartFolders) {
        els.cbSmartFolders.checked = state.smartFilter.autoExpandFolders;
        els.cbSmartFolders.addEventListener('change', (e) => {
            state.smartFilter.autoExpandFolders = e.target.checked;
            state.smartFilter.lastResult = null;
        });
    }

    if (els.exportFormatSelect) {
        loadSetting('sbor_export_format', els.exportFormatSelect, 'select');
        state.exportFormat = els.exportFormatSelect.value || 'txt';
        els.exportFormatSelect.addEventListener('change', (e) => {
            state.exportFormat = e.target.value;
            localStorage.setItem('sbor_export_format', e.target.value);
        });
    }

    if (els.cbOptimize) {
        loadSetting('sbor_cb_optimize', els.cbOptimize);
        state.optimizeCode = els.cbOptimize.checked;
        els.cbOptimize.addEventListener('change', (e) => {
            state.optimizeCode = e.target.checked;
            localStorage.setItem('sbor_cb_optimize', e.target.checked);
        });
    }

    if (els.cbRepoMap) {
        loadSetting('sbor_cb_repo_map', els.cbRepoMap);
        state.includeRepoMap = els.cbRepoMap.checked;
        els.cbRepoMap.addEventListener('change', (e) => {
            state.includeRepoMap = e.target.checked;
            localStorage.setItem('sbor_cb_repo_map', e.target.checked);
        });
    }

    if (els.searchExc) {
        els.searchExc.addEventListener('input', (e) => {
            state.searchQueryExc = e.target.value.toLowerCase();
            renderExclusionsList();
        });
    }

    if (els.searchFin) {
        els.searchFin.addEventListener('input', (e) => {
            state.searchQuerySmart = e.target.value.toLowerCase();
            renderSmartStep();
        });
    }

    if (els.searchReview) {
        els.searchReview.addEventListener('input', (e) => {
            state.searchQueryReview = e.target.value.toLowerCase();
            renderReviewList();
        });
    }
}

export function resetUI() {
    if (els.downloadBtn) els.downloadBtn.style.display = 'none';
    if (els.statusArea) els.statusArea.style.display = 'none';
    if (els.loader) els.loader.style.display = 'none';
    if (els.searchExc) els.searchExc.value = '';
    if (els.searchFin) els.searchFin.value = '';
    if (els.searchReview) els.searchReview.value = '';
    state.searchQueryExc = '';
    state.searchQueryFin = '';
    state.searchQueryReview = '';
    state.searchQuerySmart = '';
    state.saveResult = null;
    if (els.smartFilterSummary) {
        els.smartFilterSummary.innerHTML = '';
    }
    if (els.reviewSummary) {
        els.reviewSummary.innerHTML = '';
    }
    if (els.secretScanSummary) {
        els.secretScanSummary.innerHTML = '';
    }
    if (els.saveSummary) {
        els.saveSummary.innerHTML = '';
    }
    if (els.saveSmartProfile) els.saveSmartProfile.innerHTML = '';
    if (els.saveOptimization) els.saveOptimization.innerHTML = '';
    if (els.saveContext) els.saveContext.innerHTML = '';
}

export function switchStep(step) {
    state.currentStep = step;
    if (els.modalExclusions) els.modalExclusions.style.display = 'none';
    if (els.modalFinal) els.modalFinal.style.display = 'none';
    if (els.modalReview) els.modalReview.style.display = 'none';
    if (els.modalSecrets) els.modalSecrets.style.display = 'none';
    if (els.modalFinalization) els.modalFinalization.style.display = 'none';
    if (els.modalSave) els.modalSave.style.display = 'none';
    if (els.modalSettings) els.modalSettings.style.display = 'none';
    if (els.overlay) els.overlay.style.display = 'block';

    if (step === 1) {
        renderExclusionsList();
        if (els.modalExclusions) els.modalExclusions.style.display = 'flex';
    } else if (step === 2) {
        renderSmartStep();
        if (els.modalFinal) els.modalFinal.style.display = 'flex';
    } else if (step === 3) {
        renderReviewList();
        if (els.modalReview) els.modalReview.style.display = 'flex';
    } else if (step === 4) {
        renderSecretsList();
        if (els.modalSecrets) els.modalSecrets.style.display = 'flex';
    } else if (step === 5) {
        renderFinalizationStep();
        if (els.modalFinalization) els.modalFinalization.style.display = 'flex';
    } else if (step === 6) {
        renderSaveStep();
        if (els.modalSave) els.modalSave.style.display = 'flex';
    }
}
