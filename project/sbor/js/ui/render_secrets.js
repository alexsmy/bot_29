import { els, state } from '../state.js';
import { analyzeProject } from '../analyzer.js';
import { renderAnalysisPackageSettings } from './render_analysis_package.js';
import { maskSecretPreview } from '../secret_detector.js';

export function renderSecretsList() {
    renderAnalysisPackageSettings();
    els.listSecrets.innerHTML = '';

    const analysis = analyzeProject(state.acceptedFiles);
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'info-box';
    summaryDiv.style.backgroundColor = 'var(--surface-2)';
    summaryDiv.style.borderColor = 'var(--border)';
    summaryDiv.style.color = 'var(--text)';
    summaryDiv.style.marginBottom = '1.5rem';
    summaryDiv.innerHTML = `
        <strong style="display:block; margin-bottom:8px; color: var(--text);">🤖 Авто-анализ проекта</strong>
        <div><strong>Тип:</strong> ${analysis.projectType}</div>
        <div><strong>Файлов:</strong> ${analysis.totalFiles}</div>
        <div><strong>Топ форматов:</strong> ${analysis.topExtensions || 'нет данных'}</div>
        <div><strong>Секретов найдено:</strong> ${state.detectedSecrets.length}</div>
    `;
    els.listSecrets.appendChild(summaryDiv);

    if (state.detectedSecrets.length === 0) {
        const noSecDiv = document.createElement('div');
        noSecDiv.style.padding = '1rem 1.5rem';
        noSecDiv.style.color = 'var(--success)';
        noSecDiv.style.fontWeight = '500';
        noSecDiv.innerHTML = '✅ Секреты не обнаружены. Код выглядит чисто.';
        els.listSecrets.appendChild(noSecDiv);
        return;
    }

    state.detectedSecrets.forEach(sec => {
        const div = document.createElement('div');
        div.className = 'file-row secret-row';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'flex-start';
        div.dataset.secretId = sec.id;

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.width = '100%';
        topRow.style.gap = '0.75rem';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = sec.id;
        cb.value = sec.id;
        cb.checked = true;

        const label = document.createElement('label');
        label.htmlFor = sec.id;
        label.style.wordBreak = 'break-word';
        label.innerHTML = `<strong>${sec.filePath}</strong>`;

        const badge = document.createElement('span');
        badge.className = `file-tag ${sec.score >= 6 ? 'danger' : 'warning'}`;
        badge.textContent = `score ${sec.score}`;

        topRow.appendChild(cb);
        topRow.appendChild(label);
        topRow.appendChild(badge);

        const previewWrap = document.createElement('div');
        previewWrap.className = 'secret-preview';
        const maskedVal = maskSecretPreview(sec.secretValue);
        previewWrap.textContent = `${sec.prefix || ''}${sec.quote || ''}${maskedVal}${sec.quote || ''}`;

        const reasonLine = document.createElement('div');
        reasonLine.className = 'rule-meta';
        reasonLine.textContent = `Строка ${sec.lineNumber || '-'} • причины: ${(sec.reasons || []).join(', ') || 'эвристика'}`;

        div.appendChild(topRow);
        div.appendChild(previewWrap);
        div.appendChild(reasonLine);
        els.listSecrets.appendChild(div);
    });
}
