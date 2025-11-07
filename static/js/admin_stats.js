// static/js/admin_stats.js

import { fetchData } from './admin_api.js';
import { navigateToTab } from './admin_ui.js';

let statsContainer;
let statsPeriodSelect;

export function renderStats(data) {
    if (!data) {
        statsContainer.innerHTML = '<p>Не удалось загрузить статистику.</p>';
        return;
    }
    statsContainer.innerHTML = `
        <div class="stat-card clickable" data-target="users"><div class="value">${data.total_users}</div><div class="label">Пользователей</div></div>
        <div class="stat-card"><div class="value">${data.total_actions}</div><div class="label">Действий в боте</div></div>
        <div class="stat-card"><div class="value">${data.total_sessions_created}</div><div class="label">Ссылок создано</div></div>
        <div class="stat-card clickable" data-target="connections"><div class="value">${data.completed_calls}</div><div class="label">Успешных звонков</div></div>
        <div class="stat-card"><div class="value">${data.avg_call_duration}</div><div class="label">Средняя длит. (сек)</div></div>
        <div class="stat-card clickable" data-target="rooms"><div class="value">${data.active_rooms_count}</div><div class="label">Активных комнат</div></div>
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

    statsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.stat-card.clickable');
        if (card && card.dataset.target) {
            setTimeout(() => {
                navigateToTab(card.dataset.target);
            }, 150);
        }
    });
    
    loadStats();
}