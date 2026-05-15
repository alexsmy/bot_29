// project/filevault/js/modules/navigation.js

import { state, normalizeFolderId } from './state.js';

export function getVisibleFiles() {
  const query = state.query.trim().toLowerCase();
  const folderId = normalizeFolderId(state.currentFolderId);

  let filtered = state.files.filter(file => normalizeFolderId(file.folder_id) === folderId);

  if (folderId === '__crpt__') {
    filtered = state.crptFiles.map(f => ({ ...f, isCrpt: true, file_id: `crpt_${f.id}`, original_name: f.id + '.crpt', size_bytes: f.size || 0, uploaded_at: f.uploaded_at, public_url: `/api/filevault/crpt/open/${f.id}` }));
  }

  if (query) {
    filtered = filtered.filter(file => (file.original_name || '').toLowerCase().includes(query));
  }
  return sortFiles(filtered);
}

export function sortFiles(files) {
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

export function getSelectedFile() {
  return state.files.find(f => f.file_id === state.activeFileId) ||
         (state.activeFileId?.startsWith('crpt_') ? state.crptFiles.find(f => `crpt_${f.id}` === state.activeFileId) : null);
}

export function getVisibleFileIds() {
  return getVisibleFiles().map(f => f.file_id);
}

export function syncSelectionWithFiles() {
  const fileIds = new Set(state.files.map(f => f.file_id));
  state.selectedFileIds = new Set([...state.selectedFileIds].filter(id => fileIds.has(id) || id.startsWith('crpt_')));
  if (state.activeFileId && !fileIds.has(state.activeFileId) && !state.activeFileId.startsWith('crpt_')) state.activeFileId = null;
}

export function toggleFileSelection(fileId) {
  if (state.selectedFileIds.has(fileId)) state.selectedFileIds.delete(fileId);
  else state.selectedFileIds.add(fileId);
  if (state.selectedFileIds.size === 1) state.activeFileId = [...state.selectedFileIds][0];
  else if (state.selectedFileIds.size === 0) state.activeFileId = null;
}

export function clearFileSelection() {
  state.selectedFileIds.clear();
  state.activeFileId = null;
}

export function selectFolder(folderId) {
  state.currentFolderId = folderId === '__crpt__' ? '__crpt__' : (folderId || null);
  state.activeFileId = null;
  state.selectedFileIds.clear();
}
