// project/filevault/js/modules/ui.js

import { state, elements, getCurrentFolderLabel } from './state.js';
import { getVisibleFiles, getSelectedFile } from './navigation.js';
import {
  renderFolderTree,
  renderBulkSummary,
  renderSelectedDetails,
  renderEmptyFilesState,
  renderFileCard,
  renderFileTableRow,
  renderFileListItem,
  formatBytes
} from '../dom.js';

export function setMessage(text, type = 'success') {
  elements.messageBox.hidden = false;
  elements.messageBox.className = `message-box ${type}`;
  elements.messageBox.textContent = text;
}

export function hideMessage() {
  elements.messageBox.hidden = true;
  elements.messageBox.textContent = '';
  elements.messageBox.className = 'message-box';
}

export function setBusy(isBusy) {
  state.busy = isBusy;
  const btns = [elements.uploadButton, elements.clearUploadButton, elements.refreshButton, elements.createFolderButton, elements.renameFolderButton, elements.deleteFolderButton, elements.folderRefreshButton, elements.bulkMoveButton, elements.bulkDeleteButton, elements.bulkClearButton];
  btns.forEach(btn => { if (btn) btn.disabled = isBusy; });
  elements.searchInput.disabled = isBusy;
  elements.sortSelect.disabled = isBusy;
  elements.input.disabled = isBusy;
  if (state.pond) state.pond.setOptions({ disabled: isBusy });
  elements.uploadButton.textContent = isBusy ? 'Загрузка...' : 'Загрузить';
}

export function updateDashboard() {
  const dashboard = state.dashboard || { files_count: state.files.length, folders_count: 0, total_size_bytes: 0, disk_free_bytes: 0, disk_total_bytes: 0 };
  elements.dashboardFiles.textContent = dashboard.files_count ?? state.files.length;
  elements.dashboardFolders.textContent = dashboard.folders_count ?? 0;
  elements.dashboardUsed.textContent = formatBytes(dashboard.disk_used_bytes ?? 0);
  elements.dashboardFree.textContent = formatBytes(dashboard.disk_free_bytes ?? 0);
  elements.dashboardTotal.textContent = formatBytes(dashboard.disk_total_bytes ?? 0);
}

export function renderFolders() {
  const tree = state.folders;
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

export function renderBulkBar() {
  const selectedCount = state.selectedFileIds.size;
  elements.bulkBar.hidden = selectedCount === 0;
  if (!selectedCount) {
    elements.bulkSummary.innerHTML = '';
    return;
  }
  elements.bulkSummary.innerHTML = renderBulkSummary(selectedCount, getCurrentFolderLabel());
}

export function renderDetails() {
  const file = getSelectedFile();
  if (!file || state.selectedFileIds.size > 1) {
    elements.detailsPanel.innerHTML = `<div class="details-empty">${state.selectedFileIds.size > 1 ? 'Выбрано несколько файлов' : 'Ничего не выбрано'}</div>`;
    return;
  }
  elements.detailsPanel.innerHTML = renderSelectedDetails(file);
}

export function renderFiles() {
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
  renderBulkBar();
  renderDetails();
}

export function renderAll() {
  updateDashboard();
  renderFolders();
  renderFiles();
}
