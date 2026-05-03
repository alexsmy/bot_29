

import { formatBytes } from '../utils.js';
import { estimateTokens, getContextUsageHtml } from '../ai_models.js';

export function buildStatsHtml(params) {
    const {
        selectedFilesCount,
        redactedCount,
        originalSize,
        finalSize,
        optimizeCode,
        totalCommentsRemoved,
        totalEmptyLinesRemoved,
        smartResult,
        seedFilesCount,
        seedFoldersCount,
        outputContentLength,
        selectedAiModel
    } = params;

    const sizeStr = formatBytes(finalSize);

    let optStatsHtml = '';
    if (optimizeCode) {
        const savedBytes = originalSize - finalSize;
        const savedPercent = originalSize > 0 ? ((savedBytes / originalSize) * 100).toFixed(1) : 0;
        optStatsHtml = `
            <div class="stat-card" style="grid-column: span 2; background-color: #f0fdf4; border-color: #bbf7d0;">
                <div class="stat-label" style="color: #166534;">Результат оптимизации</div>
                <div class="stat-value" style="color: #15803d;">Сэкономлено: ${formatBytes(savedBytes > 0 ? savedBytes : 0)} (${savedPercent > 0 ? savedPercent : 0}%)</div>
                <div style="font-size:0.8rem; color:#166534; margin-top:4px;">Удалено комментариев: <strong>${totalCommentsRemoved}</strong> | Пустых строк: <strong>${totalEmptyLinesRemoved}</strong></div>
            </div>
        `;
    }

    let smartStatsHtml = '';
    if (smartResult) {
        smartStatsHtml = `
            <div class="stat-card" style="grid-column: span 2; background-color: #eff6ff; border-color: #bfdbfe;">
                <div class="stat-label" style="color: #1d4ed8;">Умный профиль</div>
                <div class="stat-value" style="color: #1d4ed8;">${smartResult.profileLabel}</div>
                <div style="font-size:0.8rem; color:#334155; margin-top:4px;">
                    Сиды: <strong>${seedFilesCount + seedFoldersCount}</strong> |
                    Связей: <strong>${smartResult.dependencyPaths.size}</strong> |
                    Профиль-контекст: <strong>${smartResult.finalPaths.size}</strong>
                </div>
            </div>
        `;
    }

    const tokenCount = estimateTokens(outputContentLength, selectedAiModel);
    const contextHtml = getContextUsageHtml(tokenCount, selectedAiModel);

    return `
        <div style="margin-bottom:1rem; font-weight:600; color:#1e293b;">Готово! Файл сформирован.</div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Файлов включено</div>
                <div class="stat-value highlight">${selectedFilesCount}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Скрыто секретов</div>
                <div class="stat-value danger">${redactedCount}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Итоговый размер</div>
                <div class="stat-value">${sizeStr}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Токенов (~${selectedAiModel.name})</div>
                <div class="stat-value">${tokenCount.toLocaleString()}</div>
            </div>
            ${smartStatsHtml}
            ${optStatsHtml}
        </div>
        ${contextHtml}
    `;
}

    