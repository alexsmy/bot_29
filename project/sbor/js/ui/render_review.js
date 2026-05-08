

import { els, state } from '../state.js';
import { createCheckboxRow } from '../utils.js';

function isUnderAnyFolder(path, folders) {
    if (!folders || folders.size === 0) return false;
    for (const folder of folders) {
        if (path === folder || path.startsWith(`${folder}/`)) return true;
    }
    return false;
}

export function renderReviewList() {
    els.listReview.innerHTML = '';
    const filtered = state.acceptedFiles.filter(item => item.path.toLowerCase().includes(state.searchQueryReview));
    filtered.sort((a, b) => a.path.localeCompare(b.path));

    if (filtered.length === 0) {
        els.listReview.innerHTML = '<div style="padding:1rem; color:#666;">Ничего не найдено.</div>';
        return;
    }

    const smart = state.smartFilter.lastResult;

    filtered.forEach((item, idx) => {
        let tagText = '';
        let tagClass = '';

        if (smart) {
            if (smart.seedFiles && smart.seedFiles.has(item.path)) {
                tagText = 'цель';
                tagClass = 'target';
            } else if (isUnderAnyFolder(item.path, smart.seedFolders)) {
                tagText = 'папка';
                tagClass = 'smart';
            } else if (smart.dependencyPaths && smart.dependencyPaths.has(item.path)) {
                tagText = 'зависимость';
                tagClass = 'smart';
            }
        }

        const checked = state.finalSelectedPaths.has(item.path);
        const row = createCheckboxRow(item.path, `review-${idx}`, checked, tagText, tagClass);
        const cb = row.querySelector('input');
        cb.dataset.path = item.path;
        cb.addEventListener('change', () => {
            if (cb.checked) {
                state.finalSelectedPaths.add(item.path);
            } else {
                state.finalSelectedPaths.delete(item.path);
            }
        });

        els.listReview.appendChild(row);
    });

    if (els.reviewSummary && state.smartFilter.lastResult) {
        els.reviewSummary.innerHTML = state.smartFilter.lastResult.summaryHtml;
    }
}

    