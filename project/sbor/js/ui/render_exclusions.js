

import { els, state } from '../state.js';
import { createCheckboxRow } from '../utils.js';

export function renderExclusionsList() {
    els.listExclusions.innerHTML = '';
    const filtered = state.excludedFiles.filter(item => item.path.toLowerCase().includes(state.searchQueryExc));
    filtered.sort((a, b) => a.path.localeCompare(b.path));

    if (filtered.length === 0) {
        els.listExclusions.innerHTML = '<div style="padding:1rem; color:#666;">Ничего не найдено.</div>';
        return;
    }

    filtered.forEach((item, idx) => {
        let tagText = item.reasonLabel || 'исключен';
        let tagClass = '';

        if (item.reason === 'size') {
            tagText = item.reasonLabel || 'большой файл';
            tagClass = 'danger';
        } else if (item.reason === 'git') {
            tagText = item.reasonLabel || '.gitignore';
            tagClass = 'git';
        } else if (item.reason && item.reason.startsWith('rule:')) {
            tagText = item.reasonLabel || 'правило';
            tagClass = 'warning';
        }

        const checked = state.exclusionSelectedPaths.has(item.path);
        const row = createCheckboxRow(item.path, `exc-${idx}`, checked, tagText, tagClass);
        const cb = row.querySelector('input');
        cb.dataset.path = item.path;
        cb.addEventListener('change', () => {
            if (cb.checked) {
                state.exclusionSelectedPaths.add(item.path);
            } else {
                state.exclusionSelectedPaths.delete(item.path);
            }
        });

        els.listExclusions.appendChild(row);
    });
}

    