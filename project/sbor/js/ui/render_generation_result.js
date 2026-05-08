import { els } from '../state.js';
import { buildStatsHtml } from '../generation/stats_builder.js';
import { estimateTokens } from '../ai_models.js';

export function renderGenerationResult(params) {
    if (els.generationSummary) {
        els.generationSummary.innerHTML = buildStatsHtml(params);
    }

    if (els.generationDetails) {
        const smart = params.smartResult;
        const optimizeEnabled = params.optimizeCode;
        const selectedModel = params.selectedAiModel;
        const tokenCount = estimateTokens(params.outputContentLength, selectedModel);
        const contextPercent = Math.min(100, (tokenCount / selectedModel.contextLimit) * 100).toFixed(1);
        const savedBytes = Math.max(params.originalSize - params.finalSize, 0);
        const savedPercent = params.originalSize > 0 ? ((savedBytes / params.originalSize) * 100).toFixed(1) : '0.0';
        const seedCount = params.seedFilesCount + params.seedFoldersCount;

        els.generationDetails.innerHTML = `
            <div class="generation-insight-card">
                <div class="generation-insight-title">Умный профиль</div>
                <div class="generation-insight-value">${smart ? smart.profileLabel || 'Авто' : 'Авто'}</div>
                <div class="generation-insight-text">Сиды: <strong>${seedCount}</strong> · Рекомендовано: <strong>${smart ? smart.finalPaths.size : 0}</strong></div>
            </div>
            <div class="generation-insight-card">
                <div class="generation-insight-title">Результат оптимизации</div>
                <div class="generation-insight-value">${optimizeEnabled ? `Сэкономлено ${savedBytes.toLocaleString()} Б` : 'Оптимизация выключена'}</div>
                <div class="generation-insight-text">${optimizeEnabled ? `Экономия ${savedPercent}%` : 'Файлы сохранены без сжатия'}</div>
            </div>
            <div class="generation-insight-card">
                <div class="generation-insight-title">Загрузка контекста</div>
                <div class="generation-insight-value">${tokenCount.toLocaleString()} токенов</div>
                <div class="generation-insight-text">${selectedModel.name} · ${contextPercent}% от лимита</div>
            </div>
        `;
    }
}
