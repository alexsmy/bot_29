import { deleteFile, fetchFiles, uploadFiles } from './api.js';
import { formatBytes, renderEmptyFilesState, renderFileCard, renderSelectedDetails } from './dom.js';

const state = {
    files: [],
    selectedFileId: null,
    busy: false,
    query: '',
    sort: 'date-desc',
    pond: null
};

const elements = {};

function cacheElements() {
    elements.form = document.getElementById('uploadForm');
    elements.input = document.getElementById('fileInput');
    elements.filesList = document.getElementById('filesList');
    elements.detailsPanel = document.getElementById('detailsPanel');
    elements.messageBox = document.getElementById('messageBox');
    elements.refreshButton = document.getElementById('refreshButton');
    elements.clearSelectionButton = document.getElementById('clearSelectionButton');
    elements.uploadButton = document.getElementById('uploadButton');
    elements.searchInput = document.getElementById('searchInput');
    elements.sortSelect = document.getElementById('sortSelect');
    elements.listMeta = document.getElementById('listMeta');
    elements.folderCount = document.getElementById('folderCount');
    elements.totalFiles = document.getElementById('totalFiles');
    elements.totalSize = document.getElementById('totalSize');
    elements.lastUpload = document.getElementById('lastUpload');
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
    elements.refreshButton.disabled = isBusy;
    elements.clearSelectionButton.disabled = isBusy;
    elements.input.disabled = isBusy;
    if (state.pond) state.pond.setOptions({ disabled: isBusy });
    elements.uploadButton.textContent = isBusy ? 'Загрузка...' : 'Загрузить';
}

function getUploadFiles() {
    if (state.pond) {
        return state.pond.getFiles().map((item) => item.file).filter(Boolean);
    }

    return Array.from(elements.input.files || []).filter(Boolean);
}

function clearUploadSelection() {
    if (state.pond) {
        state.pond.removeFiles();
    }
    elements.input.value = '';
}

function getSelectedFile() {
    return state.files.find((file) => file.file_id === state.selectedFileId) || null;
}

function updateStats() {
    const totalFiles = state.files.length;
    const totalSize = state.files.reduce((sum, file) => sum + (Number(file.size_bytes) || 0), 0);
    const lastUpload = state.files[0]?.uploaded_at || null;

    elements.totalFiles.textContent = String(totalFiles);
    elements.folderCount.textContent = String(totalFiles);
    elements.totalSize.textContent = formatBytes(totalSize);
    elements.lastUpload.textContent = lastUpload ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastUpload)) : '—';
}

function filterFiles(files) {
    const query = state.query.trim().toLowerCase();
    if (!query) return [...files];

    return files.filter((file) => {
        const values = [
            file.original_name,
            file.content_type,
            file.public_url,
            file.file_id
        ].join(' ').toLowerCase();
        return values.includes(query);
    });
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

function getVisibleFiles() {
    return sortFiles(filterFiles(state.files));
}

function renderDetails() {
    elements.detailsPanel.innerHTML = renderSelectedDetails(getSelectedFile());
}

function renderFiles() {
    const visibleFiles = getVisibleFiles();
    const hasFilters = Boolean(state.query.trim());

    if (state.selectedFileId && !state.files.some((file) => file.file_id === state.selectedFileId)) {
        state.selectedFileId = null;
    }

    if (!visibleFiles.length) {
        elements.filesList.innerHTML = renderEmptyFilesState(hasFilters);
    } else {
        elements.filesList.innerHTML = visibleFiles.map((file) => renderFileCard(file, state.selectedFileId)).join('');
    }

    const visibleText = visibleFiles.length === state.files.length ? `${state.files.length}` : `${visibleFiles.length} из ${state.files.length}`;
    elements.listMeta.textContent = state.files.length ? `Показано файлов: ${visibleText}` : 'Список пока пуст.';

    renderDetails();
    updateStats();
}

async function refreshFiles({ quiet = false } = {}) {
    try {
        const files = await fetchFiles();
        state.files = files;
        renderFiles();
        if (!quiet) setMessage('Список файлов обновлен.', 'success');
    } catch (error) {
        renderFiles();
        setMessage(`Не удалось загрузить список файлов: ${error.message}`, 'error');
    }
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
        const createdFiles = await uploadFiles(selectedFiles);
        state.selectedFileId = createdFiles[0]?.file_id || state.selectedFileId;
        clearUploadSelection();
        await refreshFiles({ quiet: true });
        setMessage(`Загружено файлов: ${createdFiles.length}. Полные ссылки доступны в карточках и панели действий.`, 'success');
    } catch (error) {
        setMessage(`Ошибка загрузки: ${error.message}`, 'error');
    } finally {
        setBusy(false);
    }
}

async function copyText(text, successMessage = 'Полная ссылка скопирована в буфер обмена.') {
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

async function handleAction(target) {
    const action = target?.dataset?.action;
    const fileId = target?.dataset?.fileId;

    if (action === 'select' && fileId) {
        state.selectedFileId = fileId;
        renderFiles();
        return;
    }

    if (action === 'delete' && fileId) {
        const file = state.files.find((item) => item.file_id === fileId);
        const fileName = file?.original_name || 'файл';
        const confirmed = window.confirm(`Удалить «${fileName}» с сервера?`);
        if (!confirmed) return;

        try {
            setBusy(true);
            await deleteFile(fileId);
            if (state.selectedFileId === fileId) state.selectedFileId = null;
            await refreshFiles({ quiet: true });
            setMessage('Файл удален.', 'success');
        } catch (error) {
            setMessage(`Не удалось удалить файл: ${error.message}`, 'error');
        } finally {
            setBusy(false);
        }
        return;
    }

    if (action === 'copy' && target.dataset.fileUrl) {
        try {
            await copyText(target.dataset.fileUrl);
        } catch (error) {
            setMessage(`Не удалось скопировать ссылку: ${error.message}`, 'error');
        }
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
        labelTapToUndo: 'нажмите для отмены'
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
    elements.clearSelectionButton.addEventListener('click', () => {
        clearUploadSelection();
        hideMessage();
    });
    elements.refreshButton.addEventListener('click', () => refreshFiles());

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
        const target = event.target.closest('[data-action="select"]');
        if (!target) return;
        event.preventDefault();
        handleAction(target);
    });

    elements.detailsPanel.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        handleAction(target);
    });
}

async function init() {
    cacheElements();
    initializeFilePond();
    wireEvents();
    renderFiles();
    setMessage('Файловый менеджер готов к работе.', 'success');
    await refreshFiles({ quiet: true });
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
        setMessage(`Ошибка инициализации: ${error.message}`, 'error');
        console.error(error);
    });
});
