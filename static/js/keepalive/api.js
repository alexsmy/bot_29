export async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        ...options,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
        const message = isJson ? payload?.detail || payload?.message || 'Неизвестная ошибка' : payload;
        throw new Error(message);
    }

    return payload;
}

export async function fetchStats() {
    const data = await fetchJson('/api/stats', { method: 'GET' });
    return Array.isArray(data.stats) ? data.stats : [];
}

export async function fetchConfig() {
    return fetchJson('/api/keepalive/config', { method: 'GET' });
}

export async function saveConfig(config) {
    return fetchJson('/api/keepalive/config', {
        method: 'PUT',
        body: JSON.stringify(config),
    });
}

export async function requestReload() {
    return fetchJson('/api/keepalive/reload', { method: 'POST' });
}

export function downloadJsonFile(filename, data) {
    const json = JSON.stringify(data, null, 4);
    const blob = new Blob([json + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 250);
}