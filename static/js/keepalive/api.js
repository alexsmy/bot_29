// FIX 1: Implement request deduplication to prevent duplicate API calls
const activeRequests = new Map();

export async function fetchJson(url, options = {}) {
    const { timeoutMs = 15000, signal, headers = {}, ...fetchOptions } = options;
    
    // Deduplicate GET requests within 500ms window
    const isGetRequest = (fetchOptions.method || 'GET').toUpperCase() === 'GET';
    const cacheKey = isGetRequest ? url : null;
    
    if (cacheKey && activeRequests.has(cacheKey)) {
        console.info(`[API Cache Hit] Reusing pending request for ${url}`);
        return await activeRequests.get(cacheKey);
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), Number(timeoutMs));

    const fetchPromise = (async () => {
        let response;
        try {
            response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                credentials: 'same-origin',
                ...fetchOptions,
                signal: signal || controller.signal,
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Превышено время ожидания ответа сервера.');
            }
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }

        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const payload = isJson ? await response.json() : await response.text();

        if (!response.ok) {
            const message = isJson ? payload?.detail || payload?.message || 'Неизвестная ошибка' : payload;
            const error = new Error(message);
            error.status = response.status;
            error.retryAfter = Number.parseInt(response.headers.get('retry-after') || '0', 10) || 0;
            throw error;
        }

        return payload;
    })();

    // Cache GET request for 500ms to catch duplicate rapid calls
    if (cacheKey) {
        activeRequests.set(cacheKey, fetchPromise);
        console.info(`[API Request] ${url}`);
        
        fetchPromise.finally(() => {
            // Clean up cache after 500ms to allow fresh requests
            setTimeout(() => {
                if (activeRequests.get(cacheKey) === fetchPromise) {
                    activeRequests.delete(cacheKey);
                    console.info(`[API Cache Cleared] ${url}`);
                }
            }, 500);
        });
    }

    return await fetchPromise;
}

export async function fetchStats() {
    const data = await fetchJson('/api/stats', { method: 'GET', timeoutMs: 12000 });
    return Array.isArray(data.stats) ? data.stats : [];
}

export async function fetchPinStatus() {
    return fetchJson('/api/keepalive/auth/status', { method: 'GET', timeoutMs: 8000 });
}

export async function unlockSettings(pin) {
    return fetchJson('/api/keepalive/auth/pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
    });
}

export async function lockSettings() {
    return fetchJson('/api/keepalive/auth/logout', { method: 'POST' });
}

export async function fetchConfig() {
    return fetchJson('/api/keepalive/config', { method: 'GET', timeoutMs: 10000 });
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
