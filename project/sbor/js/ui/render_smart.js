import { els, state } from '../state.js';
import { createCheckboxRow } from '../utils.js';
import { getProjectSeedSuggestions, getSmartProfileById, getSmartSeedMode } from '../smart_filter.js';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function syncSmartCheckboxState(type, path, checked) {
    const targetSet = type === 'folder' ? state.smartFilter.seedFolders : state.smartFilter.seedFiles;
    if (checked) targetSet.add(path);
    else targetSet.delete(path);

    state.smartFilter.lastResult = null;
    renderSelectionSummary();

    const profileId = els.smartProfileSelect?.value || state.smartFilter.profileId;
    const { fileOptions, folderOptions } = getProjectSeedSuggestions(state.acceptedFiles, profileId);

    if (type === 'file' && els.cbSelectAllFiles) {
        const filtered = fileOptions.filter(item => item.path.toLowerCase().includes(state.searchQuerySmart));
        els.cbSelectAllFiles.checked = filtered.length > 0 && filtered.every(item => state.smartFilter.seedFiles.has(item.path));
    } else if (type === 'folder' && els.cbSelectAllFolders) {
        const filtered = folderOptions.filter(item => item.path.toLowerCase().includes(state.searchQuerySmart));
        els.cbSelectAllFolders.checked = filtered.length > 0 && filtered.every(item => state.smartFilter.seedFolders.has(item.path));
    }
}

function renderSelectionSummary() {
    if (!els.smartFilterSummary) return;

    if (!state.smartFilter.lastResult) {
        els.smartFilterSummary.innerHTML = `
            <div class="info-box warning" style="margin: 0 0 1.5rem 0; text-align:left;">
                Отметьте исходные файлы или папки, выберите профиль и нажмите
                <strong>«Применить умный фильтр»</strong>.
                После этого откроется отдельный шаг ручной коррекции результата.
            </div>
        `;
        return;
    }

    els.smartFilterSummary.innerHTML = state.smartFilter.lastResult.summaryHtml;
}

function updateSmartSeedHint() {
    if (!els.smartSeedHint) return;

    const profileId = els.smartProfileSelect?.value || state.smartFilter.profileId;
    const profile = getSmartProfileById(profileId);
    const mode = getSmartSeedMode(profileId);

    let hint = '';
    if (mode === 'file') {
        hint = 'Для этого профиля выберите один или несколько файлов-целей.';
    } else if (mode === 'folder') {
        hint = 'Для этого профиля выберите одну или несколько папок-целей.';
    } else {
        hint = 'Можно выбрать файлы, папки или смешанный набор целей.';
    }

    els.smartSeedHint.innerHTML = `
        <div class="rule-meta">${escapeHtml(hint)}</div>
        <div class="rule-meta">${escapeHtml(profile.description)}</div>
    `;
}

function renderSeedFiles(profileMode, fileOptions) {
    if (!els.smartSeedFilesList) return;
    els.smartSeedFilesList.innerHTML = '';

    if (profileMode === 'folder') {
        els.smartSeedFilesList.parentElement.style.display = 'none';
        return;
    }

    els.smartSeedFilesList.parentElement.style.display = 'block';

    const filtered = fileOptions.filter(item => item.path.toLowerCase().includes(state.searchQuerySmart));

    if (els.cbSelectAllFiles) {
        els.cbSelectAllFiles.checked = filtered.length > 0 && filtered.every(item => state.smartFilter.seedFiles.has(item.path));
    }

    if (filtered.length === 0) {
        els.smartSeedFilesList.innerHTML = '<div style="padding:0.5rem 0; color:#64748b;">Файлы не найдены.</div>';
        return;
    }

    filtered.forEach((item, idx) => {
        const row = createCheckboxRow(item.path, `seed-file-${idx}`, state.smartFilter.seedFiles.has(item.path), 'файл', 'smart');
        const cb = row.querySelector('input');
        cb.dataset.path = item.path;
        cb.dataset.kind = 'file';
        cb.addEventListener('change', () => syncSmartCheckboxState('file', item.path, cb.checked));
        els.smartSeedFilesList.appendChild(row);
    });
}

function renderSeedFolders(profileMode, folderOptions) {
    if (!els.smartSeedFoldersList) return;
    els.smartSeedFoldersList.innerHTML = '';

    if (profileMode === 'file') {
        els.smartSeedFoldersList.parentElement.style.display = 'none';
        return;
    }

    els.smartSeedFoldersList.parentElement.style.display = 'block';

    const filtered = folderOptions.filter(item => item.path.toLowerCase().includes(state.searchQuerySmart));

    if (els.cbSelectAllFolders) {
        els.cbSelectAllFolders.checked = filtered.length > 0 && filtered.every(item => state.smartFilter.seedFolders.has(item.path));
    }

    if (filtered.length === 0) {
        els.smartSeedFoldersList.innerHTML = '<div style="padding:0.5rem 0; color:#64748b;">Папки не найдены.</div>';
        return;
    }

    filtered.forEach((item, idx) => {
        const row = createCheckboxRow(item.path, `seed-folder-${idx}`, state.smartFilter.seedFolders.has(item.path), `${item.fileCount} файлов`, 'target');
        const cb = row.querySelector('input');
        cb.dataset.path = item.path;
        cb.dataset.kind = 'folder';
        cb.addEventListener('change', () => syncSmartCheckboxState('folder', item.path, cb.checked));
        els.smartSeedFoldersList.appendChild(row);
    });
}

export function renderSmartStep() {
    const profileId = els.smartProfileSelect?.value || state.smartFilter.profileId;
    const seedMode = getSmartSeedMode(profileId);
    const { fileOptions, folderOptions } = getProjectSeedSuggestions(state.acceptedFiles, profileId);

    updateSmartSeedHint();
    renderSeedFiles(seedMode, fileOptions);
    renderSeedFolders(seedMode, folderOptions);
    renderSelectionSummary();
}
