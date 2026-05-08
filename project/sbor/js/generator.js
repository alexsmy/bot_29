import { els, state } from './state.js';
import { downloadFile } from './utils.js';
import { analyzeProject } from './analyzer.js';
import { formatOutput } from './export_formatter.js';
import { generateRepoMap } from './repo_map.js';
import { buildProcessedFiles } from './generation/content_builder.js';
import { buildStatsHtml } from './generation/stats_builder.js';

export async function executeGeneration() {
    els.modalSecrets.style.display = 'none';
    if (els.modalReview) els.modalReview.style.display = 'none';
    if (els.modalFinalize) els.modalFinalize.style.display = 'none';
    els.overlay.style.display = 'none';
    if (els.resultActions) els.resultActions.style.display = 'none';
    els.downloadBtn.style.display = 'none';
    if (els.newBuildBtn) els.newBuildBtn.style.display = 'none';
    els.loader.style.display = 'block';
    els.statusArea.style.display = 'block';
    els.statusArea.innerHTML = 'Формирование итогового файла...';

    const selectedPaths = new Set(state.finalSelectedPaths);
    const excludedSecretFiles = state.secretReview?.excludedFiles || new Set();

    for (const path of excludedSecretFiles) {
        selectedPaths.delete(path);
    }

    if (selectedPaths.size === 0) {
        els.loader.style.display = 'none';
        els.statusArea.innerHTML = 'Нечего собирать: в финальном списке не выбрано ни одного файла.';
        return;
    }

    state.finalSelectedPaths = new Set(selectedPaths);

    if (state.detectedSecrets.length > 0) {
        state.detectedSecrets.forEach(sec => {
            sec.selected = !excludedSecretFiles.has(sec.filePath);
            sec.shouldExcludeFile = excludedSecretFiles.has(sec.filePath);
        });
    }

    const selectedFilesMeta = state.acceptedFiles.filter(f => selectedPaths.has(f.path));

    const buildResult = await buildProcessedFiles(selectedFilesMeta, state.detectedSecrets, state.optimizeCode);
    state.fileContents = buildResult.fileContents;

    const analysis = analyzeProject(selectedFilesMeta);
    let repoMapText = null;
    if (state.includeRepoMap) {
        repoMapText = generateRepoMap(buildResult.processedFiles);
    }

    const smartResult = state.smartFilter.lastResult;

    state.outputContent = formatOutput(state, analysis, buildResult.processedFiles, buildResult.redactedCount, repoMapText);

    const blob = new Blob([state.outputContent], { type: 'text/plain;charset=utf-8' });
    const finalSize = blob.size;

    els.loader.style.display = 'none';

    els.statusArea.innerHTML = buildStatsHtml({
        selectedFilesCount: selectedFilesMeta.length,
        redactedCount: buildResult.redactedCount,
        originalSize: buildResult.originalSize,
        finalSize: finalSize,
        optimizeCode: state.optimizeCode,
        totalCommentsRemoved: buildResult.totalCommentsRemoved,
        totalEmptyLinesRemoved: buildResult.totalEmptyLinesRemoved,
        optimizationSourceSize: buildResult.optimizationSourceSize,
        optimizationResultSize: buildResult.optimizationResultSize,
        smartResult: smartResult,
        seedFilesCount: state.smartFilter.seedFiles.size,
        seedFoldersCount: state.smartFilter.seedFolders.size,
        outputContentLength: state.outputContent.length,
        selectedAiModel: state.selectedAiModel
    });

    if (els.resultActions) els.resultActions.style.display = 'flex';
    els.downloadBtn.style.display = 'inline-flex';
    if (els.newBuildBtn) els.newBuildBtn.style.display = 'inline-flex';

    const ext = state.exportFormat === 'xml' ? 'xml' : 'txt';
    els.downloadBtn.onclick = () => downloadFile(state.outputContent, ext);
    if (els.newBuildBtn) els.newBuildBtn.onclick = () => window.location.reload();
}
