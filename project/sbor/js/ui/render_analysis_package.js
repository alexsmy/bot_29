import { els, state } from '../state.js';

const ANALYSIS_PACKAGE_OPTIONS = [
    {
        id: 'analysis-task-context',
        key: 'taskContext',
        label: 'Включать TASK_CONTEXT',
        description: 'Добавляет сводный контекст задачи и приоритеты отбора.'
    },
    {
        id: 'analysis-entrypoints',
        key: 'entrypoints',
        label: 'Включать entrypoints',
        description: 'Подсвечивает точки входа и основные запускаемые файлы.'
    },
    {
        id: 'analysis-module-graph',
        key: 'moduleGraph',
        label: 'Включать module graph',
        description: 'Собирает краткую карту зависимостей между файлами.'
    },
    {
        id: 'analysis-change-scope',
        key: 'changeScope',
        label: 'Включать change scope',
        description: 'Фиксирует, что именно изменяется в текущей задаче.'
    }
];

function createToggleRow({ id, label, description, checked, value }) {
    const row = document.createElement('label');
    row.className = 'rule-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = checked;
    cb.value = value;
    cb.dataset.kind = 'analysis-package';

    const body = document.createElement('div');
    body.style.flex = '1';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cursor = 'pointer';
    labelEl.style.display = 'block';
    labelEl.style.fontWeight = '600';

    body.appendChild(labelEl);

    if (description) {
        const meta = document.createElement('div');
        meta.className = 'rule-meta';
        meta.textContent = description;
        body.appendChild(meta);
    }

    row.appendChild(cb);
    row.appendChild(body);

    cb.addEventListener('change', (event) => {
        const nextValue = event.target.checked;
        if (Object.prototype.hasOwnProperty.call(state.analysisPackage, value)) {
            state.analysisPackage[value] = nextValue;
        }

        document.querySelectorAll(`input[type="checkbox"][data-kind="analysis-package"][value="${value}"]`).forEach(input => {
            input.checked = nextValue;
        });
    });

    return row;
}

function renderContainer(container, withHint = false, idPrefix = 'package') {
    if (!container) return;

    container.innerHTML = '';

    ANALYSIS_PACKAGE_OPTIONS.forEach(item => {
        container.appendChild(
            createToggleRow({
                id: `${idPrefix}-${item.id}`,
                label: item.label,
                description: item.description,
                checked: state.analysisPackage[item.key] !== false,
                value: item.key
            })
        );
    });

    if (withHint) {
        const hint = document.createElement('div');
        hint.className = 'info-box';
        hint.style.marginTop = '0.75rem';
        hint.innerHTML = `
            <strong>Рабочий пакет для анализа:</strong> эти блоки можно включать выборочно, если нужен более короткий или более подробный контекст.<br>
            Для большинства задач удобно оставить включёнными все пункты.
        `;
        container.appendChild(hint);
    }
}

export function renderAnalysisPackageSettings() {
    renderContainer(els.settingsAnalysisPackageList, true, 'settings');
    renderContainer(els.finalAnalysisPackageList, false, 'finalize');
}
