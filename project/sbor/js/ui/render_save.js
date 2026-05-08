import { els, state } from '../state.js';
import { downloadFile, formatBytes } from '../utils.js';
import { estimateTokens, getContextUsageHtml } from '../ai_models.js';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSavedExtension() {
    return state.exportFormat === 'xml' ? 'xml' : 'txt';
}

function buildSummaryHtml() {
    const result = state.saveResult;
    if (!result) {
        return `
            <div class="info-box warning compact-info">
                Сборка уже сформирована, но сводка пока недоступна.
            </div>
        `;
    }

    const tokenCount = estimateTokens(result.outputContentLength || 0, state.selectedAiModel);

    return `
        <div class="stats-grid stats-grid-save">
            <div class="stat-card">
                <div class="stat-label">Файлов включено</div>
                <div class="stat-value highlight">${result.selectedFilesCount}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Скрыто секретов</div>
                <div class="stat-value danger">${result.redactedCount}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Итоговый размер</div>
                <div class="stat-value">${formatBytes(result.finalSize)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Токенов (~${escapeHtml(state.selectedAiModel.name)})</div>
                <div class="stat-value">${tokenCount.toLocaleString()}</div>
            </div>
        </div>
    `;
}

export function renderSaveStep() {
    if (els.saveSummary) {
        els.saveSummary.innerHTML = buildSummaryHtml();
    }

    if (els.saveSmartProfile) {
        const smartResult = state.saveResult?.smartResult || state.smartFilter.lastResult;
        els.saveSmartProfile.innerHTML = smartResult ? `
            <div class="save-metric">${escapeHtml(smartResult.profileLabel || 'Без профиля')}</div>
            <div class="save-metric-sub">Сиды: <strong>${(state.smartFilter.seedFiles.size + state.smartFilter.seedFolders.size)}</strong></div>
            <div class="save-metric-sub">Связей: <strong>${smartResult.dependencyPaths?.size || 0}</strong></div>
            <div class="save-metric-sub">Финальный набор: <strong>${smartResult.finalPaths?.size || 0}</strong></div>
        ` : '<div class="info-box compact-info">Умный профиль не был применён.</div>';
    }

    if (els.saveOptimization) {
        const result = state.saveResult;
        if (result?.optimizeCode) {
            const savedBytes = Math.max(0, (result.originalSize || 0) - (result.finalSize || 0));
            const savedPercent = result.originalSize > 0 ? ((savedBytes / result.originalSize) * 100).toFixed(1) : '0.0';
            els.saveOptimization.innerHTML = `
                <div class="save-metric">Включено</div>
                <div class="save-metric-sub">Удалено комментариев: <strong>${result.totalCommentsRemoved || 0}</strong></div>
                <div class="save-metric-sub">Удалено пустых строк: <strong>${result.totalEmptyLinesRemoved || 0}</strong></div>
                <div class="save-metric-sub">Экономия: <strong>${formatBytes(savedBytes)} (${savedPercent}%)</strong></div>
            `;
        } else {
            els.saveOptimization.innerHTML = `
                <div class="save-metric">Отключено</div>
                <div class="save-metric-sub">Код сохранён без сжатия.</div>
            `;
        }
    }

    if (els.saveContext) {
        const result = state.saveResult;
        const tokenCount = estimateTokens(result?.outputContentLength || 0, state.selectedAiModel);
        els.saveContext.innerHTML = getContextUsageHtml(tokenCount, state.selectedAiModel);
    }

    if (els.downloadBtn) {
        els.downloadBtn.style.display = 'inline-flex';
        els.downloadBtn.classList.add('btn-fit-content');
        els.downloadBtn.onclick = () => downloadFile(state.outputContent, getSavedExtension());
    }
}
