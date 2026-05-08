import { formatBytes } from '../utils.js';
import { estimateTokens, getContextUsageHtml } from '../ai_models.js';

function buildSmartSummaryCard(smartResult, seedFilesCount, seedFoldersCount) {
    if (!smartResult) {
        return `
            <div class="result-insight-card">
                <div class="stat-label">Умный профиль</div>
                <div class="stat-value">Не применялся</div>
                <div class="rule-meta" style="margin-top:0.35rem;">Финальная сборка собрана без smart-выборки.</div>
            </div>
        `;
    }

    return `
        <div class="result-insight-card result-insight-card--blue">
            <div class="stat-label">Умный профиль</div>
            <div class="stat-value">${smartResult.profileLabel}</div>
            <div class="rule-meta" style="margin-top:0.35rem;">
                Сиды: <strong>${seedFilesCount + seedFoldersCount}</strong> ·
                Связей: <strong>${smartResult.dependencyPaths.size}</strong> ·
                Итоговый контекст: <strong>${smartResult.finalPaths.size}</strong>
            </div>
        </div>
    `;
}

function buildOptimizationCard(optimizeCode, optimizationSourceSize, optimizationResultSize, totalCommentsRemoved, totalEmptyLinesRemoved) {
    if (!optimizeCode) {
        return `
            <div class="result-insight-card">
                <div class="stat-label">Результат оптимизации</div>
                <div class="stat-value">Оптимизация выключена</div>
                <div class="rule-meta" style="margin-top:0.35rem;">Файл сохранён без сжатия и без удаления комментариев.</div>
            </div>
        `;
    }

    const savedBytes = Math.max(0, optimizationSourceSize - optimizationResultSize);
    const savedPercent = optimizationSourceSize > 0 ? ((savedBytes / optimizationSourceSize) * 100).toFixed(1) : '0.0';

    return `
        <div class="result-insight-card result-insight-card--green">
            <div class="stat-label">Результат оптимизации</div>
            <div class="stat-value">Сэкономлено ${formatBytes(savedBytes)} (${savedPercent}%)</div>
            <div class="rule-meta" style="margin-top:0.35rem;">
                Удалено комментариев: <strong>${totalCommentsRemoved}</strong> ·
                Пустых строк: <strong>${totalEmptyLinesRemoved}</strong>
            </div>
        </div>
    `;
}

function buildContextCard(outputContentLength, selectedAiModel) {
    const tokenCount = estimateTokens(outputContentLength, selectedAiModel);
    const contextHtml = getContextUsageHtml(tokenCount, selectedAiModel);

    return `
        <div class="result-insight-card result-insight-card--context">
            <div class="stat-label">Загрузка контекста</div>
            ${contextHtml}
        </div>
    `;
}

export function buildStatsHtml(params) {
    const {
        selectedFilesCount,
        redactedCount,
        originalSize,
        finalSize,
        optimizeCode,
        totalCommentsRemoved,
        totalEmptyLinesRemoved,
        optimizationSourceSize,
        optimizationResultSize,
        smartResult,
        seedFilesCount,
        seedFoldersCount,
        outputContentLength,
        selectedAiModel
    } = params;

    const sizeStr = formatBytes(finalSize);

    const tokenCount = estimateTokens(outputContentLength, selectedAiModel);
    const contextHtml = getContextUsageHtml(tokenCount, selectedAiModel);

    return `
        <div class="result-head">
            <div class="result-step-label">Шаг 6. Сохранение</div>
            <h3>Сборка готова</h3>
            <p>Файл сформирован, можно скачать его или сразу собрать новый проект.</p>
        </div>

        <div class="stats-grid stats-grid--four">
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
        </div>

        <div class="result-insights-grid">
            ${buildSmartSummaryCard(smartResult, seedFilesCount, seedFoldersCount)}
            ${buildOptimizationCard(optimizeCode, optimizationSourceSize, optimizationResultSize, totalCommentsRemoved, totalEmptyLinesRemoved)}
            <div class="result-insight-card result-insight-card--context">
                <div class="stat-label">Загрузка контекста</div>
                ${contextHtml}
            </div>
        </div>
    `;
}
