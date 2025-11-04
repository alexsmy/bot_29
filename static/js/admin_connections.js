// static/js/admin_connections.js

// Этот модуль отвечает за логику раздела "Соединения".

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let connectionsDateInput, searchConnectionsBtn, connectionsListContainer;

async function loadConnections() {
    const date = connectionsDateInput.value;
    if (!date) { alert('Выберите дату'); return; }
    
    connectionsListContainer.innerHTML = '<div class="skeleton-list"></div>';
    const sessions = await fetchData(`connections?date=${date}`);
    
    if (!sessions || sessions.length === 0) {
        connectionsListContainer.innerHTML = '<p class="empty-list">Соединения за эту дату не найдены.</p>';
        return;
    }
    
    connectionsListContainer.innerHTML = sessions.map(session => {
        const callGroupsHtml = session.call_groups.length > 0
            ? session.call_groups.map((group, groupIndex) => {
                
                const participantsHtml = group.participants.map((p, pIndex) => {
                    const role = p.role === 'initiator' ? 'Инициатор' : 'Собеседник';
                    return `
                        <div class="participant-card">
                            <strong>${role}</strong>
                            <p><strong>ID:</strong> <code>${p.server_id.substring(0, 8)}...</code></p>
                            <p><strong>IP:</strong> ${p.ip_address} (${p.country || 'N/A'}, ${p.city || 'N/A'})</p>
                            <p><strong>Устройство:</strong> ${p.device_type}, ${p.os_info}, ${p.browser_info}</p>
                        </div>
                    `;
                }).join('');

                const durationText = group.duration_seconds !== null 
                    ? `${group.duration_seconds} сек` 
                    : (group.status === 'active' ? 'Активен' : 'N/A');
                
                const callMetaHtml = `
                    <div class="call-group-meta">
                        <span>Тип: <strong>${group.call_type || 'N/A'}</strong></span>
                        <span>Статус: <strong class="status-${group.status}">${group.status}</strong></span>
                        <span>Длительность: <strong>${durationText}</strong></span>
                    </div>
                `;

                return `
                    <div class="call-group">
                        <div class="call-group-header">Звонок #${groupIndex + 1} &middot; ${formatDate(group.start_time)}</div>
                        ${callMetaHtml}
                        <div class="participants-grid">
                            ${participantsHtml}
                        </div>
                    </div>
                `;
            }).join('')
            : '<p>В этой сессии не было зафиксировано звонков.</p>';

        // Determine session status based on call groups
        let sessionStatus = session.closed_at ? 'closed' : 'pending';
        if (session.call_groups.some(g => g.status === 'active')) {
            sessionStatus = 'active';
        } else if (session.call_groups.some(g => g.status === 'completed')) {
            sessionStatus = 'completed';
        }

        return `
        <div class="connection-item">
            <div class="connection-summary">
                <div class="summary-info">
                    <code>${session.room_id}</code>
                    <span class="session-created-at">Создана: ${formatDate(session.created_at)}</span>
                </div>
                <span class="status ${sessionStatus}">${sessionStatus}</span>
            </div>
            <div class="connection-details">
                <div class="details-section">
                    <h4>Детали сессии</h4>
                    <p><strong>Создана:</strong> ${formatDate(session.created_at)}</p>
                    ${session.closed_at ? `<p><strong>Закрыта:</strong> ${formatDate(session.closed_at)}</p>` : ''}
                    ${session.close_reason ? `<p><strong>Причина:</strong> ${session.close_reason}</p>` : ''}
                </div>
                <div class="details-section">
                    <h4>История звонков (${session.call_groups.length})</h4>
                    ${callGroupsHtml}
                </div>
            </div>
        </div>`;
    }).join('');
}

export function initConnections() {
    connectionsDateInput = document.getElementById('connections-date');
    searchConnectionsBtn = document.getElementById('search-connections-btn');
    connectionsListContainer = document.getElementById('connections-list');
    
    // Устанавливаем сегодняшнюю дату по умолчанию
    connectionsDateInput.value = new Date().toISOString().split('T')[0];

    searchConnectionsBtn.addEventListener('click', loadConnections);
    
    connectionsListContainer.addEventListener('click', (e) => {
        const summary = e.target.closest('.connection-summary');
        if (!summary) return;
        
        const details = summary.nextElementSibling;
        const item = summary.parentElement;

        // Закрываем все остальные открытые карточки
        document.querySelectorAll('.connection-item.open').forEach(openItem => {
            if (openItem !== item) {
                openItem.classList.remove('open');
                openItem.querySelector('.connection-details').style.maxHeight = null;
            }
        });

        // Открываем или закрываем текущую
        if (item.classList.contains('open')) {
            details.style.maxHeight = null;
            item.classList.remove('open');
        } else {
            details.style.maxHeight = details.scrollHeight + "px";
            item.classList.add('open');
        }
    });
    
    // Загружаем данные за сегодняшний день при инициализации
    loadConnections();
}