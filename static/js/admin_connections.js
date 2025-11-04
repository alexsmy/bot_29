// static/js/admin_connections.js

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let connectionsDateInput, searchConnectionsBtn, connectionsListContainer;

function renderParticipant(details, role) {
    if (!details) {
        return `
        <div class="participant-details">
            <h5>${role}</h5>
            <p>Информация отсутствует (возможно, звонок не был принят).</p>
        </div>`;
    }
    return `
    <div class="participant-details">
        <h5>${role}</h5>
        <p><strong>ID:</strong> ${details.websocket_user_id.substring(0, 8)}...</p>
        <p><strong>IP:</strong> ${details.ip_address} (${details.country || 'N/A'}, ${details.city || 'N/A'})</p>
        <p><strong>Устройство:</strong> ${details.device_type}, ${details.os_info}, ${details.browser_info}</p>
    </div>`;
}

function renderCallEvent(event, index) {
    const durationText = event.duration_seconds !== null ? `Длительность: <strong>${event.duration_seconds} сек</strong>` : '';
    const callType = event.call_type === 'video' ? 'Видеозвонок' : 'Аудиозвонок';

    return `
    <div class="call-event-card">
        <div class="call-event-header">
            <span class="call-event-title">Попытка звонка #${index + 1} (${callType})</span>
            <span class="status-badge ${event.status}">${event.status}</span>
        </div>
        <div class="call-event-meta">
            <span>Начат: <strong>${formatDate(event.initiated_at)}</strong></span>
            ${durationText ? `<span> | ${durationText}</span>` : ''}
        </div>
        <div class="participants-container">
            ${renderParticipant(event.caller_details, 'Инициатор')}
            ${renderParticipant(event.callee_details, 'Ответивший')}
        </div>
    </div>`;
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
        const callHistoryHtml = session.call_history.length > 0
            ? `<div class="call-history-container">${session.call_history.map(renderCallEvent).join('')}</div>`
            : '<p>В этой сессии не было зафиксировано попыток звонков.</p>';

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
                    <h4>История звонков в сессии</h4>
                    ${callHistoryHtml}
                </div>
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