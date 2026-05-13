import {
    createFolder,
    deleteFile,
    deleteFiles,
    deleteFolder,
    fetchDashboard,
    fetchFiles,
    fetchFolders,
    moveFiles,
    renameFolder,
    updateFile,
    uploadFiles
} from './api.js';
import {
    escapeHTML,
    formatBytes,
    renderBulkSummary,
    renderEmptyFilesState,
    renderFileCard,
    renderFolderOptions,
    renderFolderTree,
    renderSelectedDetails
} from './dom.js';

const state = {
    files: [],
    folders: [],
    dashboard: null,
    currentFolderId: null,
    activeFileId: null,
    selectedFileIds: new Set(),
    query: '',
    sort: 'date-desc',
    pond: null,
    busy: false,
    dialogAction: null
};

const elements = {};

function cacheElements() {
    elements.form = document.getElementById('uploadForm');
    elements.input = document.getElementById('fileInput');
    elements.uploadButton = document.getElementById('uploadButton');
    elements.clearUploadButton = document.getElementById('clearUploadButton');
    elements.refreshButton = document.getElementById('refreshButton');
    elements.searchInput = document.getElementById('searchInput');
    elements.sortSelect = document.getElementById('sortSelect');
    elements.filesList = document.getElementById('filesList');
    elements.detailsPanel = document.getElementById('detailsPanel');
    elements.bulkBar = document.getElementById('bulkBar');
    elements.bulkSummary = document.getElementById('bulkSummary');
    elements.bulkSelectVisibleButton = document.getElementById('bulkSelectVisibleButton');
    elements.bulkMoveButton = document.getElementById('bulkMoveButton');
    elements.bulkDeleteButton = document.getElementById('bulkDeleteButton');
    elements.bulkClearButton = document.getElementById('bulkClearButton');
    elements.folderTree = document.getElementById('folderTree');
    elements.currentFolderLabel = document.getElementById('currentFolderLabel');
    elements.uploadFolderLabel = document.getElementById('uploadFolderLabel');
    elements.createFolderButton = document.getElementById('createFolderButton');
    elements.renameFolderButton = document.getElementById('renameFolderButton');
    elements.deleteFolderButton = document.getElementById('deleteFolderButton');
    elements.folderRefreshButton = document.getElementById('folderRefreshButton');
    elements.messageBox = document.getElementById('messageBox');

    elements.dashboardFiles = document.getElementById('dashboardFiles');
    elements.dashboardFolders = document.getElementById('dashboardFolders');
    elements.dashboardUsed = document.getElementById('dashboardUsed');
    elements.dashboardFree = document.getElementById('dashboardFree');
    elements.dashboardTotal = document.getElementById('dashboardTotal');

    elements.actionDialog = document.getElementById('actionDialog');
    elements.actionDialogForm = document.getElementById('actionDialogForm');
    elements.actionDialogTitle = document.getElementById('actionDialogTitle');
    elements.actionDialogSubtitle = document.getElementById('actionDialogSubtitle');
    elements.actionDialogBody = document.getElementById('actionDialogBody');
    elements.actionDialogConfirm = document.getElementById('actionDialogConfirm');
    elements.actionDialogClose = document.getElementById('actionDialogClose');
    elements.actionDialogCancelButton = document.getElementById('actionDialogCancelButton');
}

function setMessage(text, type = 'success') {
    elements.messageBox.hidden = false;
    elements.messageBox.className = `message-box ${type}`;
    elements.messageBox.textContent = text;
}

function hideMessage() {
    elements.messageBox.hidden = true;
    elements.messageBox.textContent = '';
    elements.messageBox.className = 'message-box';
}

function setBusy(isBusy) {
    state.busy = isBusy;
    elements.uploadButton.disabled = isBusy;
    elements.clearUploadButton.disabled = isBusy;
    elements.refreshButton.disabled = isBusy;
    elements.searchInput.disabled = isBusy;
    elements.sortSelect.disabled = isBusy;
    elements.createFolderButton.disabled = isBusy;
    elements.renameFolderButton.disabled = isBusy;
    elements.deleteFolderButton.disabled = isBusy;
    elements.folderRefreshButton.disabled = isBusy;
    elements.bulkSelectVisibleButton.disabled = isBusy;
    elements.bulkMoveButton.disabled = isBusy;
    elements.bulkDeleteButton.disabled = isBusy;
    elements.bulkClearButton.disabled = isBusy;
    elements.input.disabled = isBusy;

    if (state.pond) {
        state.pond.setOptions({ disabled: isBusy });
    }

    elements.uploadButton.textContent = isBusy ? 'Загрузка…' : 'Загрузить';
}

function normalizeFolderId(folderId) {
    return folderId ? String(folderId) : null;
}

function getCurrentFolderNode(nodes = state.folders, folderId = state.currentFolderId) {
    if (folderId === null || folderId === '') {
        return {
            folder_id: null,
            name: 'Корень хранилища',
            path: 'Корень хранилища'
        };
    }

    for (const node of nodes) {
        if ((node.folder_id ?? null) === folderId) {
            return node;
        }
        const children = Array.isArray(node.children) ? node.children : [];
        const match = getCurrentFolderNode(children, folderId);
        if (match) return match;
    }

    return null;
}

function getCurrentFolderLabel() {
    return getCurrentFolderNode()?.path || 'Корень хранилища';
}

function getVisibleFiles() {
    const query = state.query.trim().toLowerCase();
    const folderId = normalizeFolderId(state.currentFolderId);

    const filtered = state.files.filter((file) => normalizeFolderId(file.folder_id) === folderId);

    if (!query) {
        return sortFiles(filtered);
    }

    const byQuery = filtered.filter((file) => {
        const values = [
            file.original_name,
            file.content_type,
            file.public_url,
            file.file_id,
            file.folder_path,
            file.folder_name
        ].join(' ').toLowerCase();
        return values.includes(query);
    });

    return sortFiles(byQuery);
}

function sortFiles(files) {
    const sorted = [...files];
    const byDate = (a, b) => new Date(a.uploaded_at || 0).getTime() - new Date(b.uploaded_at || 0).getTime();
    const byName = (a, b) => String(a.original_name || '').localeCompare(String(b.original_name || ''), 'ru', { sensitivity: 'base' });
    const bySize = (a, b) => (Number(a.size_bytes) || 0) - (Number(b.size_bytes) || 0);

    const sorters = {
        'date-desc': (a, b) => byDate(b, a),
        'date-asc': byDate,
        'name-asc': byName,
        'name-desc': (a, b) => byName(b, a),
        'size-desc': (a, b) => bySize(b, a),
        'size-asc': bySize
    };

    return sorted.sort(sorters[state.sort] || sorters['date-desc']);
}

function getSelectedFile() {
    return state.files.find((file) => file.file_id === state.activeFileId) || null;
}

function getVisibleFileIds() {
    return getVisibleFiles().map((file) => file.file_id);
}

function syncSelectionWithFiles() {
    const fileIds = new Set(state.files.map((file) => file.file_id));
    state.selectedFileIds = new Set([...state.selectedFileIds].filter((id) => fileIds.has(id)));

    if (state.activeFileId && !fileIds.has(state.activeFileId)) {
        state.activeFileId = null;
    }

    const currentFolder = getCurrentFolderNode();
    if (!currentFolder && state.currentFolderId !== null) {
        state.currentFolderId = null;
    }
}

function updateDashboard() {
    const dashboard = state.dashboard || {
        files_count: state.files.length,
        folders_count: 0,
        total_size_bytes: state.files.reduce((sum, file) => sum + (Number(file.size_bytes) || 0), 0),
        disk_total_bytes: 0,
        disk_free_bytes: 0
    };

    elements.dashboardFiles.textContent = String(dashboard.files_count ?? state.files.length);
    elements.dashboardFolders.textContent = String(dashboard.folders_count ?? 0);
    elements.dashboardUsed.textContent = formatBytes(dashboard.disk_used_bytes ?? 0);
    elements.dashboardFree.textContent = formatBytes(dashboard.disk_free_bytes ?? 0);
    elements.dashboardTotal.textContent = formatBytes(dashboard.disk_total_bytes ?? 0);
}

function updateFolderActions() {
    const isRoot = state.currentFolderId === null || state.currentFolderId === '';
    elements.currentFolderLabel.textContent = getCurrentFolderLabel();
    if (elements.uploadFolderLabel) elements.uploadFolderLabel.textContent = getCurrentFolderLabel();
    elements.renameFolderButton.disabled = state.busy || isRoot;
    elements.deleteFolderButton.disabled = state.busy || isRoot;
}

function renderFolders() {
    elements.folderTree.innerHTML = renderFolderTree(state.folders, state.currentFolderId, state.dashboard?.root_files_count ?? 0);
    updateFolderActions();
}

function renderBulkBar() {
    const selectedCount = state.selectedFileIds.size;
    const visibleCount = getVisibleFiles().length;
    elements.bulkBar.hidden = selectedCount === 0;
    if (!selectedCount) {
        elements.bulkSummary.innerHTML = '';
        return;
    }

    elements.bulkSummary.innerHTML = renderBulkSummary(selectedCount, getCurrentFolderLabel());
    elements.bulkSelectVisibleButton.textContent = visibleCount && selectedCount < visibleCount ? 'Выбрать все' : 'Снять выделение';
}

function renderDetails() {
    elements.detailsPanel.innerHTML = renderSelectedDetails(getSelectedFile());
}

function renderFiles() {
    const visibleFiles = getVisibleFiles();
    const hasSearch = Boolean(state.query.trim());

    if (!visibleFiles.length) {
        const message = hasSearch
            ? 'По запросу ничего не найдено.'
            : state.currentFolderId
                ? 'В этой папке пока нет файлов.'
                : 'В корне хранилища пока нет файлов.';
        elements.filesList.innerHTML = renderEmptyFilesState(message);
    } else {
        elements.filesList.innerHTML = visibleFiles.map((file) => renderFileCard(file, state.selectedFileIds.has(file.file_id))).join('');
    }

    const visibleText = visibleFiles.length ? `${visibleFiles.length}` : '0';
    const totalText = state.files.length ? `${state.files.length}` : '0';
    elements.refreshButton.title = `Всего файлов: ${totalText}`;
    elements.sortSelect.title = `Показано: ${visibleText}`;
    renderBulkBar();
    renderDetails();
}

function renderAll() {
    updateDashboard();
    renderFolders();
    renderFiles();
}

async function syncData({ quiet = false } = {}) {
    try {
        const [dashboard, folders, files] = await Promise.all([
            fetchDashboard(),
            fetchFolders(),
            fetchFiles()
        ]);

        state.dashboard = dashboard;
        state.folders = Array.isArray(folders) ? folders : [];
        state.files = Array.isArray(files) ? files : [];
        syncSelectionWithFiles();
        renderAll();

        if (!quiet) {
            setMessage('Данные хранилища обновлены.', 'success');
        }
    } catch (error) {
        renderAll();
        setMessage(`Не удалось синхронизировать данные: ${error.message}`, 'error');
    }
}

function clearFileSelection() {
    state.selectedFileIds.clear();
    renderFiles();
}

function selectFolder(folderId) {
    state.currentFolderId = folderId || null;
    state.activeFileId = null;
    state.selectedFileIds.clear();
    renderAll();
}

function toggleFileSelection(fileId) {
    if (state.selectedFileIds.has(fileId)) {
        state.selectedFileIds.delete(fileId);
    } else {
        state.selectedFileIds.add(fileId);
    }
    renderFiles();
}

function selectVisibleFiles() {
    const visibleIds = getVisibleFileIds();
    if (!visibleIds.length) return;

    const alreadyAllSelected = visibleIds.every((id) => state.selectedFileIds.has(id));
    if (alreadyAllSelected) {
        for (const id of visibleIds) {
            state.selectedFileIds.delete(id);
        }
    } else {
        for (const id of visibleIds) {
            state.selectedFileIds.add(id);
        }
    }
    renderFiles();
}

async function copyText(text, successMessage = 'Ссылка скопирована в буфер обмена.') {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }
    setMessage(successMessage, 'success');
}

function closeDialog() {
    state.dialogAction = null;
    elements.actionDialogForm.reset();
    elements.actionDialogBody.innerHTML = '';
    elements.actionDialogTitle.textContent = '';
    elements.actionDialogSubtitle.textContent = '';
    elements.actionDialogConfirm.textContent = 'Сохранить';
    elements.actionDialog.classList.remove('danger-mode');
    if (elements.actionDialog.open) {
        elements.actionDialog.close();
    }
}

function openDialog({ title, subtitle = '', bodyHTML = '', confirmText = 'Сохранить', mode = 'default', onSubmit }) {
    state.dialogAction = onSubmit;
    elements.actionDialogTitle.textContent = title;
    elements.actionDialogSubtitle.textContent = subtitle;
    elements.actionDialogBody.innerHTML = bodyHTML;
    elements.actionDialogConfirm.textContent = confirmText;
    elements.actionDialog.classList.toggle('danger-mode', mode === 'danger');
    elements.actionDialog.showModal();

    const focusTarget = elements.actionDialogBody.querySelector('input, select, textarea, button');
    if (focusTarget) {
        window.setTimeout(() => focusTarget.focus(), 0);
    }
}

async function handleDialogSubmit(event) {
    event.preventDefault();

    const onSubmit = state.dialogAction;
    if (typeof onSubmit !== 'function') {
        closeDialog();
        return;
    }

    const formData = new FormData(elements.actionDialogForm);
    try {
        await onSubmit(formData);
        closeDialog();
    } catch (error) {
        setMessage(error.message, 'error');
    }
}

function openRenameFileDialog(fileId) {
    const file = state.files.find((item) => item.file_id === fileId);
    if (!file) return;

    openDialog({
        title: 'Переименовать файл',
        subtitle: 'Имя меняется без повторной загрузки. Содержимое остается на месте.',
        confirmText: 'Переименовать',
        bodyHTML: `
            <label class="dialog-field">
                <span>Новое имя</span>
                <input name="name" type="text" value="${escapeHTML(file.original_name || '')}" autocomplete="off" required maxlength="160">
            </label>
        `,
        onSubmit: async (formData) => {
            const name = String(formData.get('name') || '').trim();
            if (!name) {
                throw new Error('Введите новое имя файла');
            }
            setBusy(true);
            try {
                await updateFile(fileId, { original_name: name });
                await syncData({ quiet: true });
                setMessage('Файл переименован.', 'success');
            } finally {
                setBusy(false);
            }
        }
    });
}

function openMoveFileDialog(fileIds) {
    const selectedCount = fileIds.length;
    const title = selectedCount === 1 ? 'Переместить файл' : `Переместить файлов: ${selectedCount}`;
    const bodyHTML = `
        <label class="dialog-field">
            <span>Папка назначения</span>
            <select name="folder_id">
                ${renderFolderOptions(state.folders, null)}
            </select>
        </label>
        <p class="dialog-note">Файлы будут перенесены в выбранную папку без изменения имени.</p>
    `;

    openDialog({
        title,
        subtitle: 'Выберите папку назначения для перемещения.',
        confirmText: 'Переместить',
        bodyHTML,
        onSubmit: async (formData) => {
            const folderIdRaw = formData.get('folder_id');
            const folderId = folderIdRaw ? String(folderIdRaw) : null;
            setBusy(true);
            try {
                await moveFiles(fileIds, folderId);
                state.selectedFileIds.clear();
                state.activeFileId = null;
                await syncData({ quiet: true });
                setMessage(selectedCount === 1 ? 'Файл перемещен.' : 'Файлы перемещены.', 'success');
            } finally {
                setBusy(false);
            }
        }
    });
}

function openFolderDialog(mode, folder = null) {
    const isRename = mode === 'rename';
    const title = isRename ? 'Переименовать папку' : 'Создать папку';
    const confirmText = isRename ? 'Переименовать' : 'Создать';
    const currentName = folder?.name || '';
    const bodyHTML = `
        <label class="dialog-field">
            <span>Название папки</span>
            <input name="name" type="text" value="${escapeHTML(currentName)}" autocomplete="off" required maxlength="96">
        </label>
        <p class="dialog-note">${isRename ? 'Название будет обновлено без изменения содержимого.' : `Папка будет создана внутри: ${getCurrentFolderLabel()}.`}</p>
    `;

    openDialog({
        title,
        subtitle: isRename ? 'Имя папки меняется сразу в дереве.' : 'Новая папка создается в текущем разделе.',
        confirmText,
        bodyHTML,
        onSubmit: async (formData) => {
            const name = String(formData.get('name') || '').trim();
            if (!name) {
                throw new Error('Введите название папки');
            }
            setBusy(true);
            try {
                if (isRename) {
                    await renameFolder(state.currentFolderId, name);
                } else {
                    await createFolder(name, state.currentFolderId);
                }
                await syncData({ quiet: true });
                setMessage(isRename ? 'Папка переименована.' : 'Папка создана.', 'success');
            } finally {
                setBusy(false);
            }
        }
    });
}

function openDeleteFolderConfirm() {
    const folder = getCurrentFolderNode();
    if (!folder || state.currentFolderId === null) return;

    const confirmed = window.confirm(`Удалить папку «${folder.name}» вместе со всем содержимым?`);
    if (!confirmed) return;

    setBusy(true);
    deleteFolder(state.currentFolderId)
        .then(() => {
            state.currentFolderId = null;
            state.activeFileId = null;
            state.selectedFileIds.clear();
            return syncData({ quiet: true });
        })
        .then(() => {
            setMessage('Папка удалена.', 'success');
        })
        .catch((error) => {
            setMessage(`Не удалось удалить папку: ${error.message}`, 'error');
        })
        .finally(() => {
            setBusy(false);
        });
}

function confirmDeleteFiles(fileIds, message) {
    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setBusy(true);
    deleteFiles(fileIds)
        .then(() => {
            for (const id of fileIds) {
                state.selectedFileIds.delete(id);
                if (state.activeFileId === id) {
                    state.activeFileId = null;
                }
            }
            return syncData({ quiet: true });
        })
        .then(() => {
            setMessage('Файлы удалены.', 'success');
        })
        .catch((error) => {
            setMessage(`Не удалось удалить файлы: ${error.message}`, 'error');
        })
        .finally(() => {
            setBusy(false);
        });
}

async function handleUpload(event) {
    event.preventDefault();
    const selectedFiles = getUploadFiles();

    if (!selectedFiles.length) {
        setMessage('Сначала выберите хотя бы один файл.', 'error');
        return;
    }

    try {
        setBusy(true);
        hideMessage();
        const createdFiles = await uploadFiles(selectedFiles, state.currentFolderId);
        clearUploadSelection();
        if (createdFiles[0]) {
            state.activeFileId = createdFiles[0].file_id;
        }
        await syncData({ quiet: true });
        setMessage(`Загружено файлов: ${createdFiles.length}.`, 'success');
    } catch (error) {
        setMessage(`Ошибка загрузки: ${error.message}`, 'error');
    } finally {
        setBusy(false);
    }
}

async function handleAction(target) {
    const action = target?.dataset?.action;
    const fileId = target?.dataset?.fileId;
    const fileUrl = target?.dataset?.fileUrl;

    if (action === 'select-file' && fileId) {
        state.activeFileId = fileId;
        renderDetails();
        return;
    }

    if (action === 'toggle-file' && fileId) {
        toggleFileSelection(fileId);
        return;
    }

    if (action === 'open-file' && fileUrl) {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    if (action === 'copy-link' && fileUrl) {
        try {
            await copyText(fileUrl);
        } catch (error) {
            setMessage(`Не удалось скопировать ссылку: ${error.message}`, 'error');
        }
        return;
    }

    if (action === 'rename-file' && fileId) {
        openRenameFileDialog(fileId);
        return;
    }

    if (action === 'move-file' && fileId) {
        openMoveFileDialog([fileId]);
        return;
    }

    if (action === 'delete-file' && fileId) {
        const file = state.files.find((item) => item.file_id === fileId);
        const fileName = file?.original_name || 'файл';
        confirmDeleteFiles([fileId], `Удалить файл «${fileName}»?`);
        return;
    }
}

function initializeFilePond() {
    if (!window.FilePond) {
        elements.input.classList.add('native-input');
        setMessage('FilePond не загрузился, включен стандартный выбор файлов.', 'error');
        return;
    }

    window.FilePond.setOptions({
        labelIdle: 'Перетащите файлы или <span class="filepond--label-action">выберите</span>',
        labelFileWaitingForSize: 'Ожидание размера',
        labelFileSizeNotAvailable: 'Размер недоступен',
        labelFileLoading: 'Загрузка',
        labelFileLoadError: 'Ошибка загрузки',
        labelFileProcessing: 'Отправка',
        labelFileProcessingComplete: 'Готово',
        labelTapToCancel: 'нажмите для отмены',
        labelTapToRetry: 'нажмите для повтора',
        labelTapToUndo: 'нажмите для отмены',
        credits: false
    });

    state.pond = window.FilePond.create(elements.input, {
        allowMultiple: true,
        instantUpload: false,
        storeAsFile: true,
        credits: false
    });
}

function wireEvents() {
    elements.form.addEventListener('submit', handleUpload);
    elements.clearUploadButton.addEventListener('click', () => {
        clearUploadSelection();
        hideMessage();
    });
    elements.refreshButton.addEventListener('click', () => syncData());

    elements.searchInput.addEventListener('input', (event) => {
        state.query = event.target.value;
        renderFiles();
    });

    elements.sortSelect.addEventListener('change', (event) => {
        state.sort = event.target.value;
        renderFiles();
    });

    elements.filesList.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        handleAction(target);
    });

    elements.filesList.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target.closest('[data-action="select-file"]');
        if (!target) return;
        event.preventDefault();
        handleAction(target);
    });

    elements.folderTree.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action="select-folder"]');
        if (!target) return;
        selectFolder(target.dataset.folderId || null);
    });

    elements.bulkSelectVisibleButton.addEventListener('click', selectVisibleFiles);
    elements.bulkMoveButton.addEventListener('click', () => {
        const ids = [...state.selectedFileIds];
        if (!ids.length) return;
        openMoveFileDialog(ids);
    });
    elements.bulkDeleteButton.addEventListener('click', () => {
        const ids = [...state.selectedFileIds];
        if (!ids.length) return;
        confirmDeleteFiles(ids, `Удалить выбранные файлы (${ids.length})?`);
    });
    elements.bulkClearButton.addEventListener('click', clearFileSelection);

    elements.createFolderButton.addEventListener('click', () => openFolderDialog('create'));
    elements.renameFolderButton.addEventListener('click', () => {
        const folder = getCurrentFolderNode();
        if (!folder || state.currentFolderId === null) return;
        openFolderDialog('rename', folder);
    });
    elements.deleteFolderButton.addEventListener('click', openDeleteFolderConfirm);
    elements.folderRefreshButton.addEventListener('click', () => syncData());

    elements.actionDialogForm.addEventListener('submit', handleDialogSubmit);
    elements.actionDialogClose.addEventListener('click', closeDialog);
    elements.actionDialogCancelButton.addEventListener('click', closeDialog);
    elements.actionDialog.addEventListener('click', (event) => {
        if (event.target === elements.actionDialog) {
            closeDialog();
        }
    });
}

function clearUploadSelection() {
    if (state.pond) {
        state.pond.removeFiles();
    }
    elements.input.value = '';
}

function getUploadFiles() {
    if (state.pond) {
        return state.pond.getFiles().map((item) => item.file).filter(Boolean);
    }
    return Array.from(elements.input.files || []).filter(Boolean);
}

async function init() {
    cacheElements();
    initializeFilePond();
    wireEvents();
    renderAll();
    setMessage('Файловый менеджер готов к работе.', 'success');
    await syncData({ quiet: true });
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
        setMessage(`Ошибка инициализации: ${error.message}`, 'error');
        console.error(error);
    });
});
