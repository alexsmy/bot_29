

import { els, state } from '../state.js';
import { switchStep } from '../ui_core.js';
import { buildSmartSelection, getProjectSeedSuggestions } from '../smart_filter.js';
import { renderSmartStep } from '../ui_render.js';

export function setupSmartEvents() {
    if (els.cbSelectAllFiles) {
        els.cbSelectAllFiles.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const profileId = els.smartProfileSelect?.value || state.smartFilter.profileId;
            const { fileOptions } = getProjectSeedSuggestions(state.acceptedFiles, profileId);
            const filtered = fileOptions.filter(item => item.path.toLowerCase().includes(state.searchQuerySmart));

            filtered.forEach(item => {
                if (isChecked) state.smartFilter.seedFiles.add(item.path);
                else state.smartFilter.seedFiles.delete(item.path);
            });
            state.smartFilter.lastResult = null;
            renderSmartStep();
        });
    }

    if (els.cbSelectAllFolders) {
        els.cbSelectAllFolders.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const profileId = els.smartProfileSelect?.value || state.smartFilter.profileId;
            const { folderOptions } = getProjectSeedSuggestions(state.acceptedFiles, profileId);
            const filtered = folderOptions.filter(item => item.path.toLowerCase().includes(state.searchQuerySmart));

            filtered.forEach(item => {
                if (isChecked) state.smartFilter.seedFolders.add(item.path);
                else state.smartFilter.seedFolders.delete(item.path);
            });
            state.smartFilter.lastResult = null;
            renderSmartStep();
        });
    }

    if (els.btnApplySmart) {
        els.btnApplySmart.addEventListener('click', async () => {
            const seedFiles = Array.from(state.smartFilter.seedFiles);
            const seedFolders = Array.from(state.smartFilter.seedFolders);

            if (seedFiles.length === 0 && seedFolders.length === 0) {
                els.statusArea.style.display = 'block';
                els.statusArea.innerHTML = 'Сначала отметьте файлы или папки-цели для умного фильтра.';
                return;
            }

            try {
                const smartResult = await buildSmartSelection({
                    seedFiles,
                    seedFolders,
                    acceptedFiles: state.acceptedFiles,
                    profileId: state.smartFilter.profileId,
                    autoAddDependencies: state.smartFilter.autoAddDependencies,
                    autoExpandFolders: state.smartFilter.autoExpandFolders
                });

                state.smartFilter.lastResult = smartResult;
                state.finalSelectedPaths = new Set(smartResult.finalPaths);
                els.searchReview.value = '';
                state.searchQueryReview = '';
                switchStep(3);
            } catch (error) {
                console.error('Ошибка умного фильтра:', error);
                els.statusArea.style.display = 'block';
                els.statusArea.innerHTML = `<strong>Ошибка умного фильтра:</strong> ${error?.message || 'Не удалось применить рекомендации.'}`;
            }
        });
    }

    if (els.btnResetSmart) {
        els.btnResetSmart.addEventListener('click', () => {
            state.smartFilter.seedFiles.clear();
            state.smartFilter.seedFolders.clear();
            state.smartFilter.lastResult = null;
            state.finalSelectedPaths = new Set();
            els.searchFin.value = '';
            state.searchQuerySmart = '';
            renderSmartStep();
        });
    }
}

    