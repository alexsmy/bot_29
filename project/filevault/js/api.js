import { API_BASE, buildPublicUrl } from './config.js';

async function parseJsonResponse(response) {
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message = payload?.error || payload?.detail || `HTTP ${response.status}`;
        throw new Error(message);
    }

    if (!payload) {
        throw new Error('Пустой ответ сервера');
    }

    return payload;
}

export async function fetchFiles() {
    const response = await fetch(`${API_BASE}/files`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
    });

    const payload = await parseJsonResponse(response);
    return Array.isArray(payload.files) ? payload.files.map(augmentFileRecord) : [];
}

export async function uploadFiles(fileList) {
    const formData = new FormData();

    for (const file of fileList) {
        formData.append('files', file, file.name);
    }

    const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
    });

    const payload = await parseJsonResponse(response);
    return Array.isArray(payload.files) ? payload.files.map(augmentFileRecord) : [];
}

export async function deleteFile(fileId) {
    const response = await fetch(`${API_BASE}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' }
    });

    return parseJsonResponse(response);
}

function augmentFileRecord(file) {
    return {
        ...file,
        public_url: buildPublicUrl(file.public_url || file.file_id)
    };
}
