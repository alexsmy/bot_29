import { API_BASE, buildPublicUrl } from './config.js';

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message = payload?.detail || payload?.error || `HTTP ${response.status}`;
        throw new Error(message);
    }

    if (!payload) {
        throw new Error('Пустой ответ сервера');
    }

    return payload;
}

function normalizeFile(file) {
    return {
        ...file,
        folder_id: file.folder_id || null,
        public_url: buildPublicUrl(file.public_url || file.file_id)
    };
}

function normalizeFolder(folder) {
    return {
        ...folder,
        folder_id: folder.folder_id || null,
        parent_id: folder.parent_id || null
    };
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
    const folders = Array.isArray(payload.tree) ? payload.tree : Array.isArray(payload.folders) ? payload.folders : [];
    return folders.map(normalizeFolder);
}

export async function uploadFiles(fileList, folderId = null) {
    const formData = new FormData();

    for (const file of fileList) {
        formData.append('files', file, file.name);
    }

    if (folderId) {
        formData.append('folder_id', folderId);
    }

    const payload = await requestJson(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
    });

    return Array.isArray(payload.files) ? payload.files.map(normalizeFile) : [];
}

export async function deleteFile(fileId) {
    return requestJson(`${API_BASE}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE'
    });
}

export async function updateFile(fileId, patch) {
    const payload = await requestJson(`${API_BASE}/files/${encodeURIComponent(fileId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
    });
    return normalizeFile(payload.file);
}

export async function moveFiles(fileIds, folderId = null) {
    const payload = await requestJson(`${API_BASE}/files/batch/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_ids: fileIds, folder_id: folderId })
    });
    return Array.isArray(payload.files) ? payload.files.map(normalizeFile) : [];
}

export async function deleteFiles(fileIds) {
    return requestJson(`${API_BASE}/files/batch/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_ids: fileIds })
    });
}

export async function createFolder(name, parentId = null) {
    const payload = await requestJson(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId })
    });
    return normalizeFolder(payload.folder);
}

export async function renameFolder(folderId, name) {
    const payload = await requestJson(`${API_BASE}/folders/${encodeURIComponent(folderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    return normalizeFolder(payload.folder);
}

export async function deleteFolder(folderId) {
    return requestJson(`${API_BASE}/folders/${encodeURIComponent(folderId)}`, {
        method: 'DELETE'
    });
}
