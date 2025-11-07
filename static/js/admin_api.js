// static/js/admin_api.js

// Этот модуль отвечает за все запросы к API админ-панели.

let API_TOKEN = '';

/**
 * Инициализирует модуль, сохраняя токен для всех последующих запросов.
 * @param {string} token - Токен администратора.
 */
export function initApi(token) {
    API_TOKEN = token;
}

/**
 * Выполняет запрос к API админ-панели.
 * @param {string} endpoint - Конечная точка API (например, 'stats').
 * @param {object} options - Опции для fetch-запроса (method, headers, body).
 * @returns {Promise<any>} - Результат запроса (JSON-объект или текст).
 */
export async function fetchData(endpoint, options = {}) {
    if (!API_TOKEN) {
        console.error("API token is not initialized. Call initApi(token) first.");
        return null;
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `/api/admin/${endpoint}${separator}token=${API_TOKEN}`;
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            if (response.status === 403) {
                // Если токен истек, перезагружаем страницу, чтобы показать ошибку
                window.location.reload();
            }
            throw new Error(`API Error: ${response.statusText}`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
            return response.json();
        }
        return response.text();
    } catch (error) {
        console.error(`Fetch error for ${endpoint}:`, error);
        return null;
    }
};