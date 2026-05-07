

import { els, state } from '../state.js';
import { analyzeProject } from '../analyzer.js';
import { renderAnalysisPackageSettings } from './render_analysis_package.js';

export function renderSecretsList() {
    renderAnalysisPackageSettings();
    els.listSecrets.innerHTML = '';

    const analysis = analyzeProject(state.acceptedFiles);
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'info-box';
    summaryDiv.style.backgroundColor = '#f8fafc';
    summaryDiv.style.borderColor = '#cbd5e1';
    summaryDiv.style.color = '#334155';
    summaryDiv.style.marginBottom = '1.5rem';
    summaryDiv.innerHTML = `
        <strong style="display:block; margin-bottom:8px; color:#0f172a;">🤖 Авто-анализ проекта:</strong>
        <div><strong>Тип:</strong> ${analysis.projectType}</div>
        <div><strong>Файлов:</strong> ${analysis.totalFiles}</div>
        <div><strong>Топ форматов:</strong> ${analysis.topExtensions}</div>
    `;
    els.listSecrets.appendChild(summaryDiv);

    if (state.detectedSecrets.length === 0) {
        const noSecDiv = document.createElement('div');
        noSecDiv.style.padding = '1rem 1.5rem';
        noSecDiv.style.color = '#16a34a';
        noSecDiv.style.fontWeight = '500';
        noSecDiv.innerHTML = '✅ Секреты не обнаружены. Код чист!';
        els.listSecrets.appendChild(noSecDiv);
        return;
    }

    state.detectedSecrets.forEach(sec => {
        const div = document.createElement('div');
        div.className = 'file-row';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'flex-start';

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.width = '100%';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = sec.id;
        cb.value = sec.id;
        cb.checked = true;

        const label = document.createElement('label');
        label.htmlFor = sec.id;
        label.innerHTML = `<strong>${sec.filePath}</strong>`;

        topRow.appendChild(cb);
        topRow.appendChild(label);

        const maskedVal = sec.secretValue.length > 6
            ? sec.secretValue.substring(0, 3) + '...' + sec.secretValue.substring(sec.secretValue.length - 3)
            : '***';
        const displayCode = `${sec.prefix.trim()} ${sec.quote}${maskedVal}${sec.quote}`;

        const codePreview = document.createElement('div');
        codePreview.className = 'secret-preview';
        codePreview.textContent = displayCode;

        div.appendChild(topRow);
        div.appendChild(codePreview);
        els.listSecrets.appendChild(div);
    });
}

    