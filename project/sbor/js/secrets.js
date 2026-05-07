import { els, state } from './state.js';
import { readFile } from './utils.js';
import { switchStep } from './ui_core.js';
import { buildSmartSelection } from './smart_filter.js';
import { detectSecretsFromFiles } from './secret_detector.js';

export async function prepareGeneration(selectedPaths) {
    if (selectedPaths && selectedPaths instanceof Set) {
        state.finalSelectedPaths = new Set(selectedPaths);
    }

    if (state.finalSelectedPaths.size === 0) {
        els.statusArea.style.display = 'block';
        els.statusArea.innerHTML = 'Нельзя перейти дальше: итоговая сборка пустая.';
        return;
    }

    els.modalReview.style.display = 'none';
    els.overlay.style.display = 'none';
    els.loader.style.display = 'block';
    els.statusArea.style.display = 'block';
    els.statusArea.innerHTML = 'Чтение файлов, анализ связей и поиск секретов...';

    try {
        state.smartFilter.lastResult = await buildSmartSelection({
            seedFiles: Array.from(state.smartFilter.seedFiles),
            seedFolders: Array.from(state.smartFilter.seedFolders),
            acceptedFiles: state.acceptedFiles,
            profileId: state.smartFilter.profileId,
            autoAddDependencies: state.smartFilter.autoAddDependencies,
            autoExpandFolders: state.smartFilter.autoExpandFolders
        });
    } catch (error) {
        console.warn('Не удалось выполнить smart-анализ:', error);
    }

    const filesToProcess = state.acceptedFiles.filter(f => state.finalSelectedPaths.has(f.path));

    const filePromises = filesToProcess.map(f => readFile(f.originalFile));
    state.fileContents = await Promise.all(filePromises);
    state.fileContents.sort((a, b) => a.path.localeCompare(b.path));

    const scanResult = detectSecretsFromFiles(state.fileContents);
    state.detectedSecrets = scanResult.findings;
    state.secretReview = {
        excludedFiles: new Set(),
        filesWithFindings: scanResult.filesWithFindings,
        summary: scanResult.summary
    };

    els.loader.style.display = 'none';

    switchStep(4);
}
