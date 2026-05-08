import { els, state } from '../state.js';
import { EXCLUSION_RULES, MAX_FILE_SIZE_MB } from '../config.js';
import { renderAnalysisPackageSettings } from './render_analysis_package.js';

function createToggleRow({ id, label, description, checked, value, kind }) {
    const row = document.createElement('div');
    row.className = 'rule-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = checked;
    cb.value = value;
    cb.dataset.kind = kind;

    const body = document.createElement('div');
    body.style.flex = '1';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    labelEl.style.cursor = 'pointer';

    body.appendChild(labelEl);

    if (description) {
        const meta = document.createElement('div');
        meta.className = 'rule-meta';
        meta.textContent = description;
        body.appendChild(meta);
    }

    row.appendChild(cb);
    row.appendChild(body);

    return row;
}

export function openSettings() {
    els.settingsGeneralList.innerHTML = '';
    els.settingsIncluded.innerHTML = '';
    els.settingsExcluded.innerHTML = '';
    els.settingsRulesList.innerHTML = '';

    const generalToggles =[
        {
            id: 'setting-use-gitignore',
            label: 'Применять .gitignore',
            description: 'Если включено, правила из .gitignore будут автоматически отсеивать лишние файлы.',
            checked: state.useGitignore,
            value: 'use-gitignore'
        },
        {
            id: 'setting-exclude-large-files',
            label: `Исключать файлы больше ${MAX_FILE_SIZE_MB}MB`,
            description: 'Обычно такие файлы только раздувают контекст и ухудшают точность анализа.',
            checked: state.excludeLargeFiles,
            value: 'exclude-large-files'
        }
    ];

    generalToggles.forEach(item => {
        els.settingsGeneralList.appendChild(
            createToggleRow({
                id: item.id,
                label: item.label,
                description: item.description,
                checked: item.checked,
                value: item.value,
                kind: 'general'
            })
        );
    });

    const sortedExtensions = Array.from(state.allExtensions).sort();

    sortedExtensions.forEach(ext => {
        const isIncluded = state.allowedExtensions.has(ext);
        const div = document.createElement('div');
        div.className = 'ext-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = `ext-${ext.replace(/[^a-z0-9]+/gi, '')}`;
        cb.value = ext;
        cb.checked = isIncluded;
        cb.dataset.kind = 'extension';

        const label = document.createElement('label');
        label.htmlFor = cb.id;
        label.textContent = ext;

        div.appendChild(cb);
        div.appendChild(label);

        if (isIncluded) {
            els.settingsIncluded.appendChild(div);
        } else {
            els.settingsExcluded.appendChild(div);
        }
    });

    EXCLUSION_RULES.forEach(rule => {
        els.settingsRulesList.appendChild(
            createToggleRow({
                id: `rule-${rule.id}`,
                label: rule.label,
                description: rule.description,
                checked: state.enabledExclusionRules.has(rule.id),
                value: rule.id,
                kind: 'rule'
            })
        );
    });

    renderAnalysisPackageSettings();

    els.modalSettings.style.display = 'flex';
}
