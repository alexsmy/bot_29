import {
  createFolder,
  deleteFiles,
  deleteFolder,
  fetchCrptFiles,
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
  renderFileTableRow,
  renderFileListItem,
  renderFolderOptions,
  renderFolderTree,
  renderSelectedDetails
} from './dom.js';
import { uploadProgress } from './upload-progress.js';
import { FileView } from './file-view.js';

const state = {
  files: [],
  folders: [],
  dashboard: null,
  currentFolderId: null,
  activeFileId: null,
  selectedFileIds: new Set(),
  query: '',
  sort: 'date-desc',
  viewMode: 'grid', // 'grid', 'list', 'table'
  pond: null,
  busy: false,
  dialogAction: null,
  crptFiles: [], // виртуальные файлы из CRPT
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

  elements.uploadProgressContainer = document.getElementById('uploadProgressContainer');
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
  const btns = [elements.uploadButton, elements.clearUploadButton, elements.refreshButton, elements.createFolderButton, elements.renameFolderButton, elements.deleteFolderButton, elements.folderRefreshButton, elements.bulkMoveButton, elements.bulkDeleteButton, elements.bulkClearButton];
  btns.forEach(btn => { if (btn) btn.disabled = isBusy; });
  elements.searchInput.disabled = isBusy;
  elements.sortSelect.disabled = isBusy;
  elements.input.disabled = isBusy;
  if (state.pond) state.pond.setOptions({ disabled: isBusy });
  elements.uploadButton.textContent = isBusy ? 'Загрузка...' : 'Загрузить';
}

function normalizeFolderId(folderId) {
  return folderId ? String(folderId) : null;
}

function getCurrentFolderNode(nodes = state.folders, folderId = state.currentFolderId) {
  if (folderId === null || folderId === '') {
    return { folder_id: null, name: 'Корень хранилища', path: 'Корень хранилища' };
  }
  for (const node of nodes) {
    if ((node.folder_id ?? null) === folderId) return node;
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

  let filtered = state.files.filter(file => normalizeFolderId(file.folder_id) === folderId);
  // добавим виртуальные файлы CRPT, если мы в корне или в специальной папке "CRPT Cloud"
  if (folderId === '__crpt__') {
    filtered = state.crptFiles.map(f => ({ ...f, isCrpt: true, file_id: `crpt_${f.id}`, original_name: f.id + '.crpt', size_bytes: f.size || 0, uploaded_at: f.uploaded_at, public_url: `/api/filevault/crpt/open/${f.id}` }));
  }

  if (query) {
    filtered = filtered.filter(file => (file.original_name || '').toLowerCase().includes(query));
  }
  return sortFiles(filtered);
}

function sortFiles(files) {
  const sorted = [...files];
  const byDate = (a,b) => new Date(a.uploaded_at||0) - new Date(b.uploaded_at||0);
  const byName = (a,b) => (a.original_name||'').localeCompare(b.original_name||'');
  const bySize = (a,b) => (a.size_bytes||0) - (b.size_bytes||0);
  const map = {
    'date-desc': (a,b) => byDate(b,a),
    'date-asc': byDate,
    'name-asc': byName,
    'name-desc': (a,b) => byName(b,a),
    'size-desc': (a,b) => bySize(b,a),
    'size-asc': bySize,
  };
  return sorted.sort(map[state.sort] || map['date-desc']);
}

function getSelectedFile() {
  return state.files.find(f => f.file_id === state.activeFileId) ||
         (state.activeFileId?.startsWith('crpt_') ? state.crptFiles.find(f => `crpt_${f.id}` === state.activeFileId) : null);
}

function getVisibleFileIds() {
  return getVisibleFiles().map(f => f.file_id);
}

function syncSelectionWithFiles() {
  const fileIds = new Set(state.files.map(f => f.file_id));
  state.selectedFileIds = new Set([...state.selectedFileIds].filter(id => fileIds.has(id) || id.startsWith('crpt_')));
  if (state.activeFileId && !fileIds.has(state.activeFileId) && !state.activeFileId.startsWith('crpt_')) state.activeFileId = null;
}

function updateDashboard() {
  const dashboard = state.dashboard || { files_count: state.files.length, folders_count: 0, total_size_bytes: 0, disk_free_bytes: 0, disk_total_bytes: 0 };
  elements.dashboardFiles.textContent = dashboard.files_count ?? state.files.length;
  elements.dashboardFolders.textContent = dashboard.folders_count ?? 0;
  elements.dashboardUsed.textContent = formatBytes(dashboard.disk_used_bytes ?? 0);
  elements.dashboardFree.textContent = formatBytes(dashboard.disk_free_bytes ?? 0);
  elements.dashboardTotal.textContent = formatBytes(dashboard.disk_total_bytes ?? 0);
}

function renderFolders() {
  const tree = state.folders;
  // добавим виртуальную папку CRPT
  const crptVirtual = { folder_id: '__crpt__', name: 'CRPT Cloud', parent_id: null, level: 0, path: 'CRPT Cloud', file_count: state.crptFiles.length, size_bytes: 0, has_children: false, children: [] };
  const fullTree = [crptVirtual, ...tree];
  elements.folderTree.innerHTML = renderFolderTree(fullTree, state.currentFolderId, state.dashboard?.root_files_count ?? 0);
  const isRoot = state.currentFolderId === null || state.currentFolderId === '';
  const isCrpt = state.currentFolderId === '__crpt__';
  elements.renameFolderButton.disabled = state.busy || (isRoot && !isCrpt);
  elements.deleteFolderButton.disabled = state.busy || isRoot || isCrpt;
  elements.currentFolderLabel.textContent = isCrpt ? 'CRPT Cloud' : getCurrentFolderLabel();
  if (elements.uploadFolderLabel) elements.uploadFolderLabel.textContent = isCrpt ? 'CRPT Cloud (только чтение)' : getCurrentFolderLabel();
}

function renderBulkBar() {
  const selectedCount = state.selectedFileIds.size;
  elements.bulkBar.hidden = selectedCount === 0;
  if (!selectedCount) {
    elements.bulkSummary.innerHTML = '';
    return;
  }
  elements.bulkSummary.innerHTML = renderBulkSummary(selectedCount, getCurrentFolderLabel());
}

function renderDetails() {
  const file = getSelectedFile();
  if (!file || state.selectedFileIds.size > 1) {
    elements.detailsPanel.innerHTML = `<div class="details-empty">${state.selectedFileIds.size > 1 ? 'Выбрано несколько файлов' : 'Ничего не выбрано'}</div>`;
    return;
  }
  elements.detailsPanel.innerHTML = renderSelectedDetails(file);
  // привязываем события к кнопкам в деталях
  const openBtn = elements.detailsPanel.querySelector('[data-action="open-file"]');
  if (openBtn) openBtn.addEventListener('click', () => { if (file.public_url) window.open(file.public_url, '_blank'); });
  const copyBtn = elements.detailsPanel.querySelector('[data-action="copy-link"]');
  if (copyBtn) copyBtn.addEventListener('click', () => navigator.clipboard.writeText(file.public_url).then(() => setMessage('Ссылка скопирована')));
  const renameBtn = elements.detailsPanel.querySelector('[data-action="rename-file"]');
  if (renameBtn) renameBtn.addEventListener('click', () => openRenameFileDialog(file.file_id));
  const moveBtn = elements.detailsPanel.querySelector('[data-action="move-file"]');
  if (moveBtn) moveBtn.addEventListener('click', () => openMoveFileDialog([file.file_id]));
  const deleteBtn = elements.detailsPanel.querySelector('[data-action="delete-file"]');
  if (deleteBtn) deleteBtn.addEventListener('click', () => confirmDeleteFiles([file.file_id], `Удалить файл «${file.original_name}»?`));
}

function renderFiles() {
  const visibleFiles = getVisibleFiles();
  const view = state.viewMode;
  let html = '';
  if (visibleFiles.length === 0) {
    html = renderEmptyFilesState('Нет файлов в этой папке');
  } else {
    if (view === 'table') {
      html = `<div class="view-table">${visibleFiles.map(f => renderFileTableRow(f, state.selectedFileIds.has(f.file_id))).join('')}</div>`;
    } else if (view === 'list') {
      html = `<div class="view-list">${visibleFiles.map(f => renderFileListItem(f, state.selectedFileIds.has(f.file_id))).join('')}</div>`;
    } else {
      html = `<div class="view-grid files-list">${visibleFiles.map(f => renderFileCard(f, state.selectedFileIds.has(f.file_id))).join('')}</div>`;
    }
  }
  elements.filesList.innerHTML = html;
  // привязываем события к карточкам
  document.querySelectorAll('.file-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.file-check input')) return;
      const fileId = card.dataset.fileId;
      if (fileId) {
        if (e.ctrlKey || e.metaKey) {
          toggleFileSelection(fileId);
        } else {
          state.activeFileId = fileId;
          if (!state.selectedFileIds.has(fileId)) {
            state.selectedFileIds.clear();
            state.selectedFileIds.add(fileId);
          }
          renderAll();
        }
      }
    });
  });
  document.querySelectorAll('.file-check input').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const fileId = cb.closest('.file-card').dataset.fileId;
      if (cb.checked) state.selectedFileIds.add(fileId);
      else state.selectedFileIds.delete(fileId);
      if (state.selectedFileIds.size === 1) state.activeFileId = [...state.selectedFileIds][0];
      else if (state.selectedFileIds.size === 0) state.activeFileId = null;
      renderAll();
    });
  });
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
    const [dashboard, folders, files, crpt] = await Promise.all([
      fetchDashboard(),
      fetchFolders(),
      fetchFiles(),
      fetchCrptFiles()
    ]);
    state.dashboard = dashboard;
    state.folders = Array.isArray(folders) ? folders : [];
    state.files = Array.isArray(files) ? files : [];
    state.crptFiles = Array.isArray(crpt) ? crpt : [];
    syncSelectionWithFiles();
    renderAll();
    if (!quiet) setMessage('Данные обновлены', 'success');
  } catch (error) {
    setMessage(`Ошибка: ${error.message}`, 'error');
  }
}

function toggleFileSelection(fileId) {
  if (state.selectedFileIds.has(fileId)) state.selectedFileIds.delete(fileId);
  else state.selectedFileIds.add(fileId);
  if (state.selectedFileIds.size === 1) state.activeFileId = [...state.selectedFileIds][0];
  else if (state.selectedFileIds.size === 0) state.activeFileId = null;
  renderAll();
}

function clearFileSelection() {
  state.selectedFileIds.clear();
  state.activeFileId = null;
  renderAll();
}

function selectFolder(folderId) {
  state.currentFolderId = folderId === '__crpt__' ? '__crpt__' : (folderId || null);
  state.activeFileId = null;
  state.selectedFileIds.clear();
  renderAll();
}

async function handleUpload(event) {
  event.preventDefault();
  const files = state.pond ? state.pond.getFiles().map(f => f.file).filter(Boolean) : Array.from(elements.input.files || []);
  if (!files.length) { setMessage('Выберите файлы', 'error'); return; }
  setBusy(true);
  hideMessage();
  uploadProgress.show(elements.uploadProgressContainer);
  try {
    for (const file of files) {
      uploadProgress.addFile(file.name);
      await uploadFiles([file], state.currentFolderId === '__crpt__' ? null : state.currentFolderId, (progress) => uploadProgress.update(file.name, progress));
      uploadProgress.complete(file.name);
    }
    uploadProgress.hideAfterDelay(2000);
    await syncData({ quiet: true });
    setMessage(`Загружено файлов: ${files.length}`, 'success');
    if (state.pond) state.pond.removeFiles();
    else elements.input.value = '';
  } catch (error) {
    setMessage(`Ошибка загрузки: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function openRenameFileDialog(fileId) {
  const file = state.files.find(f => f.file_id === fileId);
  if (!file) return;
  const newName = prompt('Новое имя файла', file.original_name);
  if (!newName) return;
  setBusy(true);
  updateFile(fileId, { original_name: newName }).then(() => syncData({ quiet: true })).finally(() => setBusy(false));
}

function openMoveFileDialog(fileIds) {
  const folderId = prompt('ID папки назначения (оставьте пустым для корня)');
  setBusy(true);
  moveFiles(fileIds, folderId || null).then(() => { clearFileSelection(); return syncData({ quiet: true }); }).finally(() => setBusy(false));
}

function confirmDeleteFiles(fileIds, message) {
  if (!confirm(message)) return;
  setBusy(true);
  deleteFiles(fileIds).then(() => { clearFileSelection(); return syncData({ quiet: true }); }).finally(() => setBusy(false));
}

function wireEvents() {
  elements.form.addEventListener('submit', handleUpload);
  elements.clearUploadButton.addEventListener('click', () => { if (state.pond) state.pond.removeFiles(); else elements.input.value = ''; hideMessage(); });
  elements.refreshButton.addEventListener('click', () => syncData());
  elements.searchInput.addEventListener('input', (e) => { state.query = e.target.value; renderFiles(); });
  elements.sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; renderFiles(); });
  elements.bulkMoveButton.addEventListener('click', () => openMoveFileDialog([...state.selectedFileIds]));
  elements.bulkDeleteButton.addEventListener('click', () => confirmDeleteFiles([...state.selectedFileIds], `Удалить ${state.selectedFileIds.size} файлов?`));
  elements.bulkClearButton.addEventListener('click', clearFileSelection);
  elements.createFolderButton.addEventListener('click', async () => { const name = prompt('Название папки'); if (name) { setBusy(true); await createFolder(name, state.currentFolderId); await syncData({ quiet: true }); setBusy(false); } });
  elements.renameFolderButton.addEventListener('click', async () => { if (state.currentFolderId === '__crpt__') return; const name = prompt('Новое имя папки'); if (name) { setBusy(true); await renameFolder(state.currentFolderId, name); await syncData(); setBusy(false); } });
  elements.deleteFolderButton.addEventListener('click', async () => { if (state.currentFolderId && state.currentFolderId !== '__crpt__' && confirm('Удалить папку со всем содержимым?')) { setBusy(true); await deleteFolder(state.currentFolderId); state.currentFolderId = null; await syncData(); setBusy(false); } });
  elements.folderRefreshButton.addEventListener('click', () => syncData());
  elements.folderTree.addEventListener('click', (e) => { const btn = e.target.closest('[data-action="select-folder"]'); if (btn) selectFolder(btn.dataset.folderId || null); });
  elements.actionDialogClose?.addEventListener('click', () => elements.actionDialog.close());
  elements.actionDialogCancelButton?.addEventListener('click', () => elements.actionDialog.close());
}

function initFilePond() {
  if (!window.FilePond) return;
  window.FilePond.setOptions({ labelIdle: 'Перетащите файлы или <span class="filepond--label-action">выберите</span>', credits: false });
  state.pond = window.FilePond.create(elements.input, { allowMultiple: true, instantUpload: false, storeAsFile: true });
}

async function init() {
  cacheElements();
  initFilePond();
  wireEvents();
  await syncData();
  // инициализация переключателей вида
  new FileView((mode) => { state.viewMode = mode; renderFiles(); });
  setMessage('Готово', 'success');
}

document.addEventListener('DOMContentLoaded', init);