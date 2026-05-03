
import { els, state } from '../state.js';

const ANALYSIS_PACKAGE_OPTIONS = [
    {
        id: 'setting-package-task-context',
        label: 'Включать TASK_CONTEXT',
        description: 'Добавляет в начало файла краткий блок с типом проекта, объёмом сборки и полезными сигналами.',
        key: 'taskContext'
    },
    {
        id: 'setting-package-entrypoints',
        label: 'Включать ENTRYPOINTS',
        description: 'Показывает точки входа по именам файлов, корневым HTML и стартовым модулям.',
        key: 'entrypoints'
    },
    {
        id: 'setting-package-module-graph',
        label: 'Включать MODULE_GRAPH',
        description: 'Строит карту связей между файлами по import / require / script / link / @import.',
        key: 'moduleGraph'
    },
    {
        id: 'setting-package-change-scope',
        label: 'Включать CHANGE_SCOPE',
        description: 'Показывает, где вероятнее всего придётся работать: по папкам, расширениям и типу проекта.',
        key: 'changeScope'
    }
];

function createToggleRow({ id, label, description, checked, value }) {
    const row = document.createElement('div');
    row.className = 'rule-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = checked;
    cb.value = value;
    cb.dataset.kind = 'analysis-package';

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

function renderContainer(container, withHint = false) {
    if (!container) return;

    container.innerHTML = '';

    ANALYSIS_PACKAGE_OPTIONS.forEach(item => {
        container.appendChild(
            createToggleRow({
                id: item.id,
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
    renderContainer(els.settingsAnalysisPackageList, true);
    renderContainer(els.secretsAnalysisPackageList, false);
}
