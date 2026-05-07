

import { els, state } from './state.js';
import { AI_MODELS } from './ai_models.js';
import { SMART_PROFILES } from './smart_filter.js';
import { renderExclusionsList, renderSmartStep, renderReviewList, renderSecretsList } from './ui_render.js';

export function initUI() {

    const loadSetting = (key, el, type = 'checkbox') => {
        const val = localStorage.getItem(key);
        if (val !== null) {
            if (type === 'checkbox') el.checked = val === 'true';
            else el.value = val;
        }
    };

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
        state.exportFormat = els.exportFormatSelect.value;
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

    els.searchExc.addEventListener('input', (e) => {
        state.searchQueryExc = e.target.value.toLowerCase();
        renderExclusionsList();
    });

    els.searchFin.addEventListener('input', (e) => {
        state.searchQuerySmart = e.target.value.toLowerCase();
        renderSmartStep();
    });

    if (els.searchReview) {
        els.searchReview.addEventListener('input', (e) => {
            state.searchQueryReview = e.target.value.toLowerCase();
            renderReviewList();
        });
    }
}

export function resetUI() {
    els.downloadBtn.style.display = 'none';
    els.statusArea.style.display = 'none';
    els.loader.style.display = 'none';
    els.searchExc.value = '';
    els.searchFin.value = '';
    if (els.searchReview) els.searchReview.value = '';
    state.searchQueryExc = '';
    state.searchQueryFin = '';
    state.searchQueryReview = '';
    state.searchQuerySmart = '';
    if (els.smartFilterSummary) {
        els.smartFilterSummary.innerHTML = '';
    }
    if (els.reviewSummary) {
        els.reviewSummary.innerHTML = '';
    }
    if (els.secretScanSummary) {
        els.secretScanSummary.innerHTML = '';
    }
}

export function switchStep(step) {
    state.currentStep = step;
    els.modalExclusions.style.display = 'none';
    els.modalFinal.style.display = 'none';
    if (els.modalReview) els.modalReview.style.display = 'none';
    els.modalSecrets.style.display = 'none';
    els.modalSettings.style.display = 'none';
    els.overlay.style.display = 'block';

    if (step === 1) {
        renderExclusionsList();
        els.modalExclusions.style.display = 'flex';
    } else if (step === 2) {
        renderSmartStep();
        els.modalFinal.style.display = 'flex';
    } else if (step === 3) {
        renderReviewList();
        if (els.modalReview) els.modalReview.style.display = 'flex';
    } else if (step === 4) {
        renderSecretsList();
        els.modalSecrets.style.display = 'flex';
    }
}

    