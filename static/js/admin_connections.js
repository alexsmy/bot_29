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
        const participantsHtml = session.participants.length > 0 
            ? session.participants.map((p, index) => `
                <div class="participant-card">
                    <strong>Участник ${index + 1}</strong>
                    <p><strong>IP:</strong> ${p.ip_address} (${p.country || 'N/A'}, ${p.city || 'N/A'})</p>
                    <p><strong>Устройство:</strong> ${p.device_type}, ${p.os_info}, ${p.browser_info}</p>
                </div>`).join('')
            : '<p>Нет информации об участниках.</p>';

        return `
        <div class="connection-item">
            <div class="connection-summary">
                <div class="summary-info">
                    <code>${session.room_id}</code>
                    <div class="meta">
                       Тип: ${session.call_type || 'N/A'} | Длительность: ${session.duration_seconds !== null ? session.duration_seconds + ' сек' : 'N/A'}
                    </div>
                </div>
                <span class="status ${session.status}">${session.status}</span>
            </div>
            <div class="connection-details">
                <h4>Детали сессии</h4>
                <p><strong>Создана:</strong> ${formatDate(session.created_at)}</p>
                ${session.closed_at ? `<p><strong>Закрыта:</strong> ${formatDate(session.closed_at)}</p>` : ''}
                ${session.close_reason ? `<p><strong>Причина:</strong> ${session.close_reason}</p>` : ''}
                <hr>
                <h4>Участники</h4>
                ${participantsHtml}
            </div>
        </div>`;
    }).join('');
}

export function initConnections() {
    connectionsDateInput = document.getElementById('connections-date');
    searchConnectionsBtn = document.getElementById('search-connections-btn');
    connectionsListContainer = document.getElementById('connections-list');
    
    connectionsDateInput.value = new Date().toISOString().split('T')[0];

    searchConnectionsBtn.addEventListener('click', loadConnections);
    
    connectionsListContainer.addEventListener('click', (e) => {
        const summary = e.target.closest('.connection-summary');
        if (!summary) return;
        
        const details = summary.nextElementSibling;
        const item = summary.parentElement;

        if (details.style.maxHeight) {
            details.style.maxHeight = null;
            item.classList.remove('open');
        } else {
            details.style.maxHeight = details.scrollHeight + "px";
            item.classList.add('open');
        }
    });
}