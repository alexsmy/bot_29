import { els, state } from '../state.js';
import { EXCLUSION_RULES } from '../config.js';
import { applyTheme } from '../settings_store.js';
import { renderAnalysisPackageSettings } from './render_analysis_package.js';

function createRowContainer() {
    const row = document.createElement('div');
    row.className = 'rule-row';
    return row;
}

function createToggleRow({ id, label, description, checked, value, kind }) {
    const row = createRowContainer();

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

function createNumberRow({ id, label, description, value, min, max, step, kind, setting }) {
    const row = createRowContainer();

    const body = document.createElement('div');
    body.style.flex = '1';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    labelEl.style.cursor = 'pointer';

    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.value = String(value);
    if (typeof min === 'number') input.min = String(min);
    if (typeof max === 'number') input.max = String(max);
    if (typeof step === 'number') input.step = String(step);
    input.className = 'setting-number';
    input.dataset.kind = kind;
    input.dataset.setting = setting;

    body.appendChild(labelEl);
    if (description) {
        const meta = document.createElement('div');
        meta.className = 'rule-meta';
        meta.textContent = description;
        body.appendChild(meta);
    }
    body.appendChild(input);

    row.appendChild(body);
    return row;
}

function createSelectRow({ id, label, description, value, options, kind, setting }) {
    const row = createRowContainer();

    const body = document.createElement('div');
    body.style.flex = '1';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    labelEl.style.cursor = 'pointer';

    const select = document.createElement('select');
    select.id = id;
    select.className = 'ai-select';
    select.dataset.kind = kind;
    select.dataset.setting = setting;

    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        select.appendChild(opt);
    });

    select.value = value;

    body.appendChild(labelEl);
    if (description) {
        const meta = document.createElement('div');
        meta.className = 'rule-meta';
        meta.textContent = description;
        body.appendChild(meta);
    }
    body.appendChild(select);

    row.appendChild(body);
    return row;
}

function renderExtensionLists() {
    els.settingsIncluded.innerHTML = '';
    els.settingsExcluded.innerHTML = '';

    const sortedExtensions = Array.from(state.allExtensions).sort();
    if (sortedExtensions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'info-box';
        empty.textContent = 'Расширения будут показаны после выбора папки.';
        els.settingsIncluded.appendChild(empty);
        return;
    }

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
}

export function openSettings() {
    els.settingsAppearanceList.innerHTML = '';
    els.settingsGeneralList.innerHTML = '';
    els.settingsLimitsList.innerHTML = '';
    els.settingsRulesList.innerHTML = '';
    els.settingsSecretList.innerHTML = '';

    els.settingsAppearanceList.appendChild(
        createToggleRow({
            id: 'setting-theme-dark',
            label: 'Тёмная тема',
            description: 'Включает тёмный интерфейс для комфортной работы вечером и на мобильных устройствах.',
            checked: state.appSettings.theme === 'dark',
            value: 'theme',
            kind: 'appearance'
        })
    );

    const generalToggles = [
        {
            id: 'setting-use-gitignore',
            label: 'Применять .gitignore',
            description: 'Если включено, правила из .gitignore автоматически отсекают лишние файлы.',
            checked: state.useGitignore,
            value: 'use-gitignore'
        },
        {
            id: 'setting-exclude-large-files',
            label: 'Исключать большие файлы',
            description: 'Обычно такие файлы раздувают контекст и ухудшают точность анализа.',
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

    els.settingsLimitsList.appendChild(
        createNumberRow({
            id: 'setting-max-file-size',
            label: 'Максимальный размер файла, MB',
            description: 'Файлы больше этого лимита будут исключены из выборки.',
            value: state.appSettings.maxFileSizeMb,
            min: 1,
            max: 100,
            step: 1,
            kind: 'limit',
            setting: 'maxFileSizeMb'
        })
    );

    els.settingsSecretList.appendChild(
        createNumberRow({
            id: 'setting-secret-min-length',
            label: 'Минимальная длина кандидата',
            description: 'Короткие строки вроде testtoken больше не будут считаться секретом.',
            value: state.appSettings.secretDetection.minLength,
            min: 8,
            max: 128,
            step: 1,
            kind: 'secret',
            setting: 'minLength'
        })
    );

    els.settingsSecretList.appendChild(
        createNumberRow({
            id: 'setting-secret-min-score',
            label: 'Минимальный балл уверенности',
            description: 'Чем выше значение, тем строже фильтр и тем меньше ложных срабатываний.',
            value: state.appSettings.secretDetection.minScore,
            min: 1,
            max: 10,
            step: 1,
            kind: 'secret',
            setting: 'minScore'
        })
    );

    els.settingsSecretList.appendChild(
        createNumberRow({
            id: 'setting-secret-min-entropy',
            label: 'Минимальная энтропия',
            description: 'Высокая энтропия помогает находить настоящие ключи и токены, а не обычные слова.',
            value: state.appSettings.secretDetection.minEntropy,
            min: 1,
            max: 6,
            step: 0.1,
            kind: 'secret',
            setting: 'minEntropy'
        })
    );

    els.settingsSecretList.appendChild(
        createToggleRow({
            id: 'setting-secret-require-name-hint',
            label: 'Требовать имя-подсказку',
            description: 'Усиливает защиту от ложных срабатываний в обычных строках и тестовых переменных.',
            checked: state.appSettings.secretDetection.requireNameHint,
            value: 'requireNameHint',
            kind: 'secret'
        })
    );

    renderExtensionLists();

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
    els.overlay.style.display = 'block';
}

export function closeSettings() {
    if (els.modalSettings) {
        els.modalSettings.style.display = 'none';
    }
    if (els.overlay && state.currentStep === 0) {
        els.overlay.style.display = 'none';
    }
}
