// static/js/admin_connections.js

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let connectionsDateInput, searchConnectionsBtn, connectionsListContainer;

function renderCallHistory(calls) {
    if (!calls || calls.length === 0) {
        return '<p>В этой сессии не было звонков.</p>';
    }

    return `<div class="call-history-list">` + calls.map((call, index) => `
        <div class="call-card">
            <div class="call-card-header">
                <h5>Звонок #${index + 1} (${call.call_type || 'N/A'})</h5>
                <span class="connection-type-badge">${call.connection_type || 'N/A'}</span>
            </div>
            <div class="call-card-body">
                <p><strong>Начало:</strong> ${formatDate(call.call_started_at)}</p>
                <p><strong>Длительность:</strong> ${call.duration_seconds !== null ? call.duration_seconds + ' сек' : 'Активен'}</p>
                <p><strong>Участник 1:</strong> ${call.participant1_ip || 'N/A'}</p>
                <p><strong>Участник 2:</strong> ${call.participant2_ip || 'N/A'}</p>
            </div>
        </div>
    `).join('') + `</div>`;
}

async function loadConnections() {
    const date = connectionsDateInput.value;
    if (!date) { alert('Выберите дату'); return; }
    
    connectionsListContainer.innerHTML = '<div class="skeleton-list"></div>';
    const sessions = await fetchData(`connections?date=${date}`);
    
    if (!sessions || sessions.length === 0) {
        connectionsListContainer.innerHTML = '<p class="empty-list">Сессии за эту дату не найдены.</p>';
        return;
    }
    
    connectionsListContainer.innerHTML = sessions.map(session => {
        const callHistoryHtml = renderCallHistory(session.calls);

        return `
        <div class="connection-item">
            <div class="connection-summary">
                <div class="summary-info">
                    <code>${session.room_id}</code>
                    <div class="meta">
                       Создана: ${formatDate(session.created_at)}
                    </div>
                </div>
                <span class="status ${session.status}">${session.status}</span>
            </div>
            <div class="connection-details">
                <h4>История звонков в сессии</h4>
                ${callHistoryHtml}
                <hr>
                <h4>Детали сессии</h4>
                ${session.closed_at ? `<p><strong>Закрыта:</strong> ${formatDate(session.closed_at)}</p>` : ''}
                ${session.close_reason ? `<p><strong>Причина:</strong> ${session.close_reason}</p>` : ''}
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