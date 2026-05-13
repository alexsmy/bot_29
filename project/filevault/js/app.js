import { deleteFile, fetchFiles, uploadFiles } from './api.js';
import { formatBytes, renderEmptyFilesState, renderFileCard, renderSelectedFiles } from './dom.js';

const state = {
    selectedFiles: [],
    files: [],
    busy: false
};

const elements = {};

function cacheElements() {
    elements.form = document.getElementById('uploadForm');
    elements.input = document.getElementById('fileInput');
    elements.dropzone = document.getElementById('dropzone');
    elements.selectedFiles = document.getElementById('selectedFiles');
    elements.filesList = document.getElementById('filesList');
    elements.messageBox = document.getElementById('messageBox');
    elements.refreshButton = document.getElementById('refreshButton');
    elements.clearSelectionButton = document.getElementById('clearSelectionButton');
    elements.uploadButton = document.getElementById('uploadButton');
    elements.listMeta = document.getElementById('listMeta');
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

    elements.uploadButton.textContent = isBusy ? 'Загрузка...' : 'Загрузить на сервер';
}

function renderSelected() {
    elements.selectedFiles.innerHTML = renderSelectedFiles(state.selectedFiles);
}

function updateStats() {
    const totalFiles = state.files.length;
    const totalSize = state.files.reduce((sum, file) => sum + (Number(file.size_bytes) || 0), 0);
    const lastUpload = state.files[0]?.uploaded_at || null;

    elements.totalFiles.textContent = String(totalFiles);
    elements.totalSize.textContent = formatBytes(totalSize);
    elements.lastUpload.textContent = lastUpload ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastUpload)) : '—';
    elements.listMeta.textContent = totalFiles ? `Найдено файлов: ${totalFiles}` : 'Список пока пуст.';
}

function renderFiles() {
    if (!state.files.length) {
        elements.filesList.innerHTML = renderEmptyFilesState();
        updateStats();
        return;
    }

    elements.filesList.innerHTML = state.files.map(renderFileCard).join('');
    updateStats();
}

function normalizeIncomingFiles(fileList) {
    return Array.from(fileList || []).filter(Boolean);
}

function setSelectedFiles(fileList) {
    state.selectedFiles = normalizeIncomingFiles(fileList);
    renderSelected();
}

function appendSelectedFiles(fileList) {
    const nextFiles = [...state.selectedFiles];
    for (const file of normalizeIncomingFiles(fileList)) {
        if (!nextFiles.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) {
            nextFiles.push(file);
        }
    }
    state.selectedFiles = nextFiles;
    renderSelected();
}

async function refreshFiles({ quiet = false } = {}) {
    try {
        const files = await fetchFiles();
        state.files = files;
        renderFiles();
        if (!quiet) {
            setMessage('Список файлов обновлен.', 'success');
        }
    } catch (error) {
        renderFiles();
        setMessage(`Не удалось загрузить список файлов: ${error.message}`, 'error');
    }
}

async function handleUpload(event) {
    event.preventDefault();

    if (!state.selectedFiles.length) {
        setMessage('Сначала выберите хотя бы один файл.', 'error');
        return;
    }

    try {
        setBusy(true);
        hideMessage();

        await uploadFiles(state.selectedFiles);
        setSelectedFiles([]);
        elements.input.value = '';
        await refreshFiles({ quiet: true });
        setMessage('Файлы успешно загружены. Ссылки обновлены в списке ниже.', 'success');
    } catch (error) {
        setMessage(`Ошибка загрузки: ${error.message}`, 'error');
    } finally {
        setBusy(false);
    }
}

async function copyText(text, successMessage = 'Ссылка скопирована в буфер обмена.') {
    await navigator.clipboard.writeText(text);
    setMessage(successMessage, 'success');
}

async function handleListAction(target) {
    const action = target?.dataset?.action;
    const fileId = target?.dataset?.fileId;

    if (action === 'delete' && fileId) {
        const confirmed = window.confirm('Удалить файл с сервера?');
        if (!confirmed) return;

        try {
            setBusy(true);
            await deleteFile(fileId);
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
        return;
    }

    if (action === 'copy-name' && target.dataset.fileName) {
        try {
            await copyText(target.dataset.fileName, 'Имя файла скопировано в буфер обмена.');
        } catch (error) {
            setMessage(`Не удалось скопировать имя файла: ${error.message}`, 'error');
        }
    }
}

function wireEvents() {
    elements.form.addEventListener('submit', handleUpload);

    elements.input.addEventListener('change', (event) => {
        setSelectedFiles(event.target.files);
        hideMessage();
    });

    elements.clearSelectionButton.addEventListener('click', () => {
        setSelectedFiles([]);
        elements.input.value = '';
        hideMessage();
    });

    elements.refreshButton.addEventListener('click', () => refreshFiles());

    elements.filesList.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        handleListAction(target);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        elements.dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            elements.dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        elements.dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            elements.dropzone.classList.remove('dragover');
        });
    });

    elements.dropzone.addEventListener('drop', (event) => {
        const files = event.dataTransfer?.files;
        if (files?.length) {
            appendSelectedFiles(files);
        }
    });
}

async function init() {
    cacheElements();
    wireEvents();
    setSelectedFiles([]);
    renderFiles();
    setMessage('Страница готова. Выберите файлы для загрузки.', 'success');
    await refreshFiles({ quiet: true });
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
        setMessage(`Ошибка инициализации: ${error.message}`, 'error');
        console.error(error);
    });
});
