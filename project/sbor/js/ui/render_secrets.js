import { els, state } from '../state.js';
import { analyzeProject } from '../analyzer.js';
import { renderAnalysisPackageSettings } from './render_analysis_package.js';
import { summarizeDetections } from '../secret_detector.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildSummaryHtml(summary) {
    return `
        <div class="info-box" style="background:#eff6ff; border-color:#bfdbfe; color:#1e3a8a;">
            <strong style="display:block; margin-bottom:8px; color:#0f172a;">🔎 Сводка поиска секретов</strong>
            <div><strong>Всего кандидатов:</strong> ${summary.total}</div>
            <div><strong>Высокая уверенность:</strong> ${summary.high}</div>
            <div><strong>Средняя уверенность:</strong> ${summary.medium}</div>
            <div><strong>Низкая уверенность:</strong> ${summary.low}</div>
            <div style="margin-top:8px; font-size:0.9rem; color:#334155;">
                Короткие тестовые строки вроде <code>testtoken</code> больше не должны проходить как секреты: проходят только длинные значения, смешанные последовательности и известные токенные префиксы.
            </div>
        </div>
    `;
}

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
        <div><strong>Тип:</strong> ${escapeHtml(analysis.projectType)}</div>
        <div><strong>Файлов:</strong> ${analysis.totalFiles}</div>
        <div><strong>Топ форматов:</strong> ${escapeHtml(analysis.topExtensions || 'Нет данных')}</div>
    `;
    els.listSecrets.appendChild(summaryDiv);

    const summary = summarizeDetections(state.detectedSecrets);
    const summaryBlock = document.createElement('div');
    summaryBlock.innerHTML = buildSummaryHtml(summary);
    els.listSecrets.appendChild(summaryBlock);

    if (state.detectedSecrets.length === 0) {
        const noSecDiv = document.createElement('div');
        noSecDiv.style.padding = '1rem 1.5rem';
        noSecDiv.style.color = '#16a34a';
        noSecDiv.style.fontWeight = '500';
        noSecDiv.innerHTML = '✅ Похожих на секреты значений не найдено.';
        els.listSecrets.appendChild(noSecDiv);
        return;
    }

    const sorted = [...state.detectedSecrets].sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
        return a.matchIndex - b.matchIndex;
    });

    sorted.forEach(sec => {
        const div = document.createElement('div');
        div.className = 'file-row';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'flex-start';
        div.style.gap = '0.4rem';
        if (sec.selected === false) {
            div.style.opacity = '0.55';
        }

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'flex-start';
        topRow.style.width = '100%';
        topRow.style.gap = '0.75rem';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = sec.id;
        cb.value = sec.id;
        cb.checked = sec.selected !== false;
        cb.style.marginTop = '0.2rem';
        cb.addEventListener('change', () => {
            sec.selected = cb.checked;
            div.style.opacity = cb.checked ? '1' : '0.55';
        });

        const labelWrap = document.createElement('div');
        labelWrap.style.flex = '1';
        labelWrap.style.minWidth = '0';

        const label = document.createElement('label');
        label.htmlFor = sec.id;
        label.style.cursor = 'pointer';
        label.style.display = 'block';
        label.style.fontWeight = '700';
        label.style.color = '#0f172a';
        label.innerHTML = `${escapeHtml(sec.filePath)} <span class="file-tag warning">${escapeHtml(sec.kind || sec.category || 'secret')}</span> <span class="file-tag danger">${sec.confidence}%</span>`;

        const meta = document.createElement('div');
        meta.className = 'rule-meta';
        meta.textContent = sec.reasonText || 'подозрительное значение';

        labelWrap.appendChild(label);
        labelWrap.appendChild(meta);

        topRow.appendChild(cb);
        topRow.appendChild(labelWrap);

        const codePreview = document.createElement('div');
        codePreview.className = 'secret-preview';
        codePreview.textContent = sec.preview || sec.secretValue || sec.fullMatch;

        div.appendChild(topRow);
        div.appendChild(codePreview);
        els.listSecrets.appendChild(div);
    });
}
