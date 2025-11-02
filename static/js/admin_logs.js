// static/js/admin_logs.js

// Этот модуль отвечает за логику раздела "Логи".

import { fetchData } from './admin_api.js';
import { highlightLogs } from './admin_utils.js';

let logsContent;
const API_TOKEN = document.body.dataset.token; // Токен нужен для формирования ссылок

async function loadLogs() {
    const logs = await fetchData('logs');
    logsContent.innerHTML = highlightLogs(logs || 'Файл логов пуст.');
}

export function initLogs() {
    logsContent = document.getElementById('logs-content');

    document.getElementById('refresh-logs-btn').addEventListener('click', loadLogs);
    
    document.getElementById('download-logs-btn').addEventListener('click', () => {
        window.location.href = `/api/admin/logs/download?token=${API_TOKEN}`;
    });

    document.getElementById('clear-logs-btn').addEventListener('click', async () => {
        if (confirm('Очистить файл логов?')) {
            await fetchData('logs', { method: 'DELETE' });
            loadLogs();
        }
    });

    loadLogs();
}