// static/js/admin_stats.js

// Этот модуль отвечает за логику раздела "Статистика".

import { fetchData } from './admin_api.js';

let statsContainer;
let statsPeriodSelect;

function renderStats(data) {
    if (!data) {
        statsContainer.innerHTML = '<p>Не удалось загрузить статистику.</p>';
        return;
    }
    statsContainer.innerHTML = `
        <div class="stat-card"><div class="value">${data.total_users}</div><div class="label">Пользователей</div></div>
        <div class="stat-card"><div class="value">${data.total_actions}</div><div class="label">Действий в боте</div></div>
        <div class="stat-card"><div class="value">${data.total_sessions_created}</div><div class="label">Ссылок создано</div></div>
        <div class="stat-card"><div class="value">${data.completed_calls}</div><div class="label">Успешных звонков</div></div>
        <div class="stat-card"><div class="value">${data.avg_call_duration}</div><div class="label">Средняя длит. (сек)</div></div>
        <div class="stat-card"><div class="value">${data.active_rooms_count}</div><div class="label">Активных комнат</div></div>
    `;
}

export async function loadStats() {
    const period = statsPeriodSelect.value;
    const data = await fetchData(`stats?period=${period}`);
    renderStats(data);
}

export function initStats() {
    statsContainer = document.getElementById('stats-container');
    statsPeriodSelect = document.getElementById('stats-period');
    
    statsPeriodSelect.addEventListener('change', loadStats);
    
    // Первоначальная загрузка
    loadStats();
}