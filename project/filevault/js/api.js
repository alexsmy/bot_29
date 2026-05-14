import { API_BASE, OPEN_BASE, buildPublicUrl } from './config.js';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
  return payload;
}

function normalizeFile(file) {
  return { ...file, folder_id: file.folder_id || null, public_url: buildPublicUrl(file.public_url || file.file_id) };
}

export async function fetchDashboard() {
  const payload = await requestJson(`${API_BASE}/dashboard`);
  return payload.dashboard || null;
}
export async function fetchFiles() {
  const payload = await requestJson(`${API_BASE}/files`);
  return Array.isArray(payload.files) ? payload.files.map(normalizeFile) : [];
}
export async function fetchFolders() {
  const payload = await requestJson(`${API_BASE}/folders`);
  const folders = Array.isArray(payload.tree) ? payload.tree : [];
  return folders;
}
export async function fetchCrptFiles() {
  const payload = await requestJson(`${API_BASE}/crpt/files`);
  return Array.isArray(payload.files) ? payload.files : [];
}
export async function uploadFiles(fileList, folderId = null, onProgress) {
  const formData = new FormData();
  fileList.forEach(f => formData.append('files', f, f.name));
  if (folderId) formData.append('folder_id', folderId);
  // Простейший прогресс – через xhr
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch(e) { reject(new Error('Ошибка парсинга ответа')); }
      } else reject(new Error(`HTTP ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('POST', `${API_BASE}/upload`);
    xhr.send(formData);
  });
  const payload = await promise;
  return Array.isArray(payload.files) ? payload.files.map(normalizeFile) : [];
}
export async function deleteFiles(fileIds) {
  return requestJson(`${API_BASE}/files/batch/delete`, { method: 'POST', body: JSON.stringify({ file_ids: fileIds }), headers: { 'Content-Type': 'application/json' } });
}
export async function moveFiles(fileIds, folderId = null) {
  const payload = await requestJson(`${API_BASE}/files/batch/move`, { method: 'POST', body: JSON.stringify({ file_ids: fileIds, folder_id: folderId }), headers: { 'Content-Type': 'application/json' } });
  return Array.isArray(payload.files) ? payload.files.map(normalizeFile) : [];
}
export async function updateFile(fileId, patch) {
  const payload = await requestJson(`${API_BASE}/files/${encodeURIComponent(fileId)}`, { method: 'PATCH', body: JSON.stringify(patch), headers: { 'Content-Type': 'application/json' } });
  return normalizeFile(payload.file);
}
export async function createFolder(name, parentId = null) {
  return requestJson(`${API_BASE}/folders`, { method: 'POST', body: JSON.stringify({ name, parent_id: parentId }), headers: { 'Content-Type': 'application/json' } });
}
export async function renameFolder(folderId, name) {
  return requestJson(`${API_BASE}/folders/${encodeURIComponent(folderId)}`, { method: 'PATCH', body: JSON.stringify({ name }), headers: { 'Content-Type': 'application/json' } });
}
export async function deleteFolder(folderId) {
  return requestJson(`${API_BASE}/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' });
}