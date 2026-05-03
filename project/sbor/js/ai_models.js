

export const AI_MODELS =[
    { id: 'gpt45', name: 'OpenAI GPT', contextLimit: 2000000, tokensPerChar: 0.25 },
    { id: 'claude35', name: 'Claude', contextLimit: 1000000, tokensPerChar: 0.28 },
    { id: 'gemini15', name: 'Google Gemini', contextLimit: 2000000, tokensPerChar: 0.25 },
    { id: 'llama3', name: 'Meta Llama', contextLimit: 128000, tokensPerChar: 0.3 },
    { id: 'legacy', name: 'DeepSeek, Qwen итп.', contextLimit: 32000, tokensPerChar: 0.25 }
];

export function estimateTokens(textLength, model) {
    return Math.ceil(textLength * model.tokensPerChar);
}

export function getContextUsageHtml(tokenCount, model) {
    const percentage = Math.min(100, (tokenCount / model.contextLimit) * 100).toFixed(1);
    let statusClass = '';

    if (percentage > 90) statusClass = 'danger';
    else if (percentage > 70) statusClass = 'warning';

    return `
        <div class="ai-context-wrapper">
            <div class="ai-context-header">
                <span>Загрузка контекста: <strong>${model.name}</strong></span>
                <span>${tokenCount.toLocaleString()} / ${model.contextLimit.toLocaleString()} токенов (${percentage}%)</span>
            </div>
            <div class="ai-progress-bar">
                <div class="ai-progress-fill ${statusClass}" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;
}

    