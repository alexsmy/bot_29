// project/filevault/js/app.js (facade)

import { createFolder, renameFolder, deleteFolder } from './api.js';
import { state, elements, cacheElements } from './modules/state.js';
import { selectFolder, toggleFileSelection, clearFileSelection, getSelectedFile } from './modules/navigation.js';
import { setMessage, hideMessage, setBusy, renderFiles, renderAll } from './modules/ui.js';
import { syncData } from './modules/sync.js';
import { handleUpload, openRenameFileDialog, openMoveFileDialog, confirmDeleteFiles, confirmDeleteCrptFile } from './modules/file-operations.js';
import { FileView } from './file-view.js';

function wireEvents() {
  elements.form.addEventListener('submit', handleUpload);

  elements.clearUploadButton.addEventListener('click', () => {
    if (state.pond) state.pond.removeFiles();
    else elements.input.value = '';
    hideMessage();
  });

  elements.refreshButton.addEventListener('click', () => syncData());
  elements.folderRefreshButton.addEventListener('click', () => syncData());

  elements.searchInput.addEventListener('input', (e) => {
    state.query = e.target.value;
    renderFiles();
  });

  elements.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderFiles();
  });

  elements.bulkMoveButton.addEventListener('click', () => openMoveFileDialog([...state.selectedFileIds]));
  elements.bulkDeleteButton.addEventListener('click', () => confirmDeleteFiles([...state.selectedFileIds], `Удалить ${state.selectedFileIds.size} файлов?`));
  elements.bulkClearButton.addEventListener('click', clearFileSelection);

  elements.createFolderButton.addEventListener('click', async () => {
    const name = prompt('Название папки');
    if (name) {
      setBusy(true);
      await createFolder(name, state.currentFolderId);
      await syncData({ quiet: true });
      setBusy(false);
    }
  });

  elements.renameFolderButton.addEventListener('click', async () => {
    if (state.currentFolderId === '__crpt__') return;
    const name = prompt('Новое имя папки');
    if (name) {
      setBusy(true);
      await renameFolder(state.currentFolderId, name);
      await syncData();
      setBusy(false);
    }
  });

  elements.deleteFolderButton.addEventListener('click', async () => {
    if (state.currentFolderId && state.currentFolderId !== '__crpt__' && confirm('Удалить папку со всем содержимым?')) {
      setBusy(true);
      await deleteFolder(state.currentFolderId);
      state.currentFolderId = null;
      await syncData();
      setBusy(false);
    }
  });

  elements.folderTree.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="select-folder"]');
    if (btn) {
      selectFolder(btn.dataset.folderId || null);
      renderAll();
    }
  });

  elements.filesList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-crpt-btn');
    if (deleteBtn) {
      e.stopPropagation();
      const fileId = deleteBtn.dataset.crptId;
      if (fileId && confirm('Удалить этот файл из CRPT Cloud?')) {
        confirmDeleteCrptFile(fileId);
      }
      return;
    }

    const checkbox = e.target.closest('.file-check input');
    if (checkbox) {
      const fileId = checkbox.closest('.file-card').dataset.fileId;
      if (checkbox.checked) state.selectedFileIds.add(fileId);
      else state.selectedFileIds.delete(fileId);
      if (state.selectedFileIds.size === 1) state.activeFileId = [...state.selectedFileIds][0];
      else if (state.selectedFileIds.size === 0) state.activeFileId = null;
      renderAll();
      return;
    }

    const card = e.target.closest('.file-card');
    if (card) {
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
        }
        renderAll();
      }
    }
  });

  elements.detailsPanel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const file = getSelectedFile();
    if (!file) return;
    const action = btn.dataset.action;
    switch (action) {
      case 'open-file':
        if (file.public_url) window.open(file.public_url, '_blank');
        break;
      case 'copy-link':
        navigator.clipboard.writeText(file.public_url).then(() => setMessage('Ссылка скопирована'));
        break;
      case 'rename-file':
        if (!file.isCrpt) openRenameFileDialog(file.file_id);
        break;
      case 'move-file':
        if (!file.isCrpt) openMoveFileDialog([file.file_id]);
        break;
      case 'delete-file':
        if (file.isCrpt) confirmDeleteCrptFile(file.id);
        else confirmDeleteFiles([file.file_id], `Удалить файл «${file.original_name}»?`);
        break;
    }
  });

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

  new FileView((mode) => { state.viewMode = mode; renderFiles(); });
  setMessage('Готово', 'success');
}

document.addEventListener('DOMContentLoaded', init);