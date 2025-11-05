
// static/js/admin_connections.js

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let connectionsDateInput, searchConnectionsBtn, connectionsListContainer;

function getDeviceIcon(deviceType) {
    if (deviceType === 'Mobile' || deviceType === 'Tablet') return '📱';
    if (deviceType === 'Desktop') return '🖥️';
    return '⚙️';
}

function renderParticipantDetails(ip, connections) {
    if (!ip) return '<p><strong>IP:</strong> N/A</p>';

    const conn = connections.find(c => c.ip_address === ip);
    if (!conn) {
        return `<p><strong>IP:</strong> ${ip}</p>`;
    }

    return `
        <p><strong>IP:</strong> ${ip}</p>
        <div class="participant-details">
            <span>${getDeviceIcon(conn.device_type)} ${conn.device_type || 'N/A'}, ${conn.os_info || 'N/A'}, ${conn.browser_info || 'N/A'}</span>
            <span>📌 ${conn.country || 'N/A'}, ${conn.city || 'N/A'}</span>
        </div>
    `;
}

function renderCallHistory(calls, connections) {
    if (!calls || calls.length === 0) {
        return '<p>В этой сессии не было звонков.</p>';
    }

    return `<div class="call-history-list">` + calls.map((call, index) => {
        const callTypeIcon = call.call_type === 'video' ? '📹' : '🔈';
        
        return `
        <div class="call-card">
            <div class="call-card-header">
                <div class="call-header-main">
                    <span class="call-type-icon">${callTypeIcon}</span>
                    <h5>Звонок #${index + 1}</h5>
                    <div class="call-header-meta">
                        <span>Начало: ${formatDate(call.call_started_at)}</span>
                        <span>Длительность: ${call.duration_seconds !== null ? call.duration_seconds + ' сек' : 'N/A'}</span>
                    </div>
                </div>
                <span class="connection-type-badge ${call.connection_type?.toLowerCase()}">${call.connection_type || 'N/A'}</span>
            </div>
            <div class="call-card-body participants-grid">
                <div class="participant-column">
                    <h6>Участник 1</h6>
                    ${renderParticipantDetails(call.participant1_ip, connections)}
                </div>
                <div class="participant-column">
                    <h6>Участник 2</h6>
                    ${renderParticipantDetails(call.participant2_ip, connections)}
                </div>
            </div>
        </div>
    `}).join('') + `</div>`;
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
        const callHistoryHtml = renderCallHistory(session.calls, session.connections);
        const closureInfo = session.closed_at 
            ? `<div class="timestamp-item"><strong>Закрыта:</strong><span>${formatDate(session.closed_at)}</span><small>${session.close_reason || 'N/A'}</small></div>`
            : '<div class="timestamp-item"></div>'; // Placeholder for alignment

        return `
        <div class="connection-item">
            <div class="connection-summary">
                <div class="summary-info">
                    <code>${session.room_id}</code>
                    <div class="summary-timestamps">
                        <div class="timestamp-item">
                            <strong>Создана:</strong>
                            <span>${formatDate(session.created_at)}</span>
                        </div>
                        ${closureInfo}
                    </div>
                </div>
                <span class="status ${session.status}">${session.status}</span>
            </div>
            <div class="connection-details">
                <h4>История звонков в сессии</h4>
                ${callHistoryHtml}
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