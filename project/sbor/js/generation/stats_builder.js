import { formatBytes } from '../utils.js';
import { estimateTokens } from '../ai_models.js';

export function buildStatsHtml(params) {
    const {
        selectedFilesCount,
        redactedCount,
        finalSize,
        outputContentLength,
        selectedAiModel
    } = params;

    const sizeStr = formatBytes(finalSize);
    const tokenCount = estimateTokens(outputContentLength, selectedAiModel);

    return `
        <div class="generation-ready">Готово! Файл сформирован.</div>
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
    `;
}
