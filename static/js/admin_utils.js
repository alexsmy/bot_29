
// static/js/admin_utils.js

// Этот модуль содержит вспомогательные функции (утилиты) для админ-панели.

/**
 * Форматирует ISO-строку даты в локализованный формат.
 * @param {string} isoString - Дата в формате ISO.
 * @returns {string} - Отформатированная дата или 'N/A'.
 */
export function formatDate(isoString) {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('ru-RU', {
        timeZone: 'UTC',
        dateStyle: 'short',
        timeStyle: 'medium'
    });
}

/**
 * Форматирует секунды в строку времени HH:MM:SS.
 * @param {number} seconds - Количество секунд.
 * @returns {string} - Отформатированное время.
 */
export function formatRemainingTime(seconds) {
    if (seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

/**
 * Экранирует HTML-символы в строке.
 * @param {string} unsafe - Небезопасная строка.
 * @returns {string} - Безопасная строка.
 */
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * Применяет подсветку синтаксиса к тексту логов.
 * @param {string} logText - Текст логов.
 * @returns {string} - HTML-строка с подсветкой.
 */
export function highlightLogs(logText) {
    return logText.split('\n').map(line => {
        const escapedLine = escapeHtml(line);
        let className = 'log-default';

        if (line.includes('CRITICAL')) className = 'log-critical';
        else if (line.includes('ERROR')) className = 'log-error';
        else if (line.includes('WARNING')) className = 'log-warning';
        else if (line.includes('INFO')) className = 'log-info';

        if (line.match(/\s(2\d{2})\s/)) className = 'log-http-2xx';
        else if (line.match(/\s(3\d{2})\s/)) className = 'log-http-3xx';
        else if (line.match(/\s(4\d{2})\s/)) className = 'log-http-4xx';
        else if (line.match(/\s(5\d{2})\s/)) className = 'log-http-5xx';

        return `<span class="log-line ${className}">${escapedLine}</span>`;
    }).join('');
}