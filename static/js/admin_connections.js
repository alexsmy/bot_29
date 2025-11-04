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
        const callEventsHtml = session.call_events.length > 0
            ? session.call_events.map((event, eventIndex) => {
                const participantsHtml = event.participants.map((p, pIndex) => `
                    <div class="participant-card">
                        <strong>Участник ${pIndex + 1}</strong>
                        <p><strong>IP:</strong> ${p.ip_address} (${p.country || 'N/A'}, ${p.city || 'N/A'})</p>
                        <p><strong>Устройство:</strong> ${p.device_type}, ${p.os_info}, ${p.browser_info}</p>
                    </div>
                `).join('');

                const connectionType = event.connection_type || 'N/A';
                const connectionTypeClass = connectionType === 'relay' ? 'type-relay' : 'type-p2p';

                let callMetaHtml = `
                    <div class="call-group-meta">
                        <span>Тип: <strong>${event.call_type || 'N/A'}</strong></span>
                        <span>Длительность: <strong>${event.duration_seconds !== null ? `${event.duration_seconds} сек` : 'N/A'}</strong></span>
                        <span>Соединение: <strong class="conn-type ${connectionTypeClass}">${connectionType.toUpperCase()}</strong></span>
                    </div>
                `;

                return `
                    <div class="call-group">
                        <div class="call-group-header">Звонок #${eventIndex + 1} &middot; ${formatDate(event.call_started_at)}</div>
                        ${callMetaHtml}
                        ${participantsHtml}
                    </div>
                `;
            }).join('')
            : '<p>В этой сессии не было зафиксировано звонков.</p>';

        return `
        <div class="connection-item">
            <div class="connection-summary">
                <div class="summary-info">
                    <code>${session.room_id}</code>
                </div>
                <span class="status ${session.status}">${session.status}</span>
            </div>
            <div class="connection-details">
                <div class="details-section">
                    <h4>Детали сессии</h4>
                    <p><strong>Создана:</strong> ${formatDate(session.created_at)}</p>
                    ${session.closed_at ? `<p><strong>Закрыта:</strong> ${formatDate(session.closed_at)}</p>` : ''}
                    ${session.close_reason ? `<p><strong>Причина:</strong> ${session.close_reason}</p>` : ''}
                </div>
                <div class="details-section">
                    <h4>Звонки в рамках сессии</h4>
                    ${callEventsHtml}
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

        document.querySelectorAll('.connection-item.open').forEach(openItem => {
            if (openItem !== item) {
                openItem.classList.remove('open');
                openItem.querySelector('.connection-details').style.maxHeight = null;
            }
        });

        if (item.classList.contains('open')) {
            details.style.maxHeight = null;
            item.classList.remove('open');
        } else {
            details.style.maxHeight = details.scrollHeight + "px";
            item.classList.add('open');
        }
    });
    
    loadConnections();
}