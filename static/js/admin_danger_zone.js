// static/js/admin_danger_zone.js

// Этот модуль отвечает за логику "Опасной зоны".

import { fetchData } from './admin_api.js';

export function initDangerZone() {
    document.getElementById('wipe-db-btn').addEventListener('click', async () => {
        if (confirm('ВЫ УВЕРЕНЕНЫ, ЧТО ХОТИТЕ ПОЛНОСТЬЮ ОЧИСТИТЬ БАЗУ ДАННЫХ?')) {
            await fetchData('database', { method: 'DELETE' });
            alert('База данных очищена. Страница будет перезагружена.');
            window.location.reload();
        }
    });
}