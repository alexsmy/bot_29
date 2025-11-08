
import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let connectionsDateInput, searchConnectionsBtn, connectionsListContainer;

function renderParticipantDetails(ip, connections, isInitiator) {
    if (!ip) return '<p>N/A</p>';

    const conn = connections.find(c => c.ip_address === ip);
    const initiatorClass = isInitiator ? 'initiator' : 'receiver';

    const detailsHtml = conn ? `
        <span><span class="icon icon-device">${ICONS.device}</span> ${conn.device_type || 'N/A'}, ${conn.os_info || 'N/A'}, ${conn.browser_info || 'N/A'}</span>
        <span><span class="icon icon-location">${ICONS.location}</span> ${conn.country || 'N/A'}, ${conn.city || 'N/A'}</span>
    ` : '';

    return `
        <div class="participant-column">
            <h6 class="${initiatorClass}">
                <span class="icon icon-person">${ICONS.person}</span>
                <span>${isInitiator ? 'Инициатор' : 'Участник'}</span>
            </h6>
            <div class="participant-details">
                <span><span class="icon icon-ip">${ICONS.ip}</span> ${ip}</span>
                ${detailsHtml}
            </div>
        </div>
    `;
}

function getCallTypeIcon(callType) {
    const iconSvg = callType === 'video' 
        ? ICONS.videoCallActive
        : ICONS.audioCallActive;
    return `<span class="call-status-icon" title="Тип звонка: ${callType}">${iconSvg}</span>`;
}

function renderCallHistory(calls, connections) {
    if (!calls || calls.length === 0) {
        return '<p style="padding: 0 1rem 1rem; margin: 0; font-size: 0.9em; color: var(--text-secondary);">В этой сессии не было звонков.</p>';
    }

    return `<div class="call-history-list">` + calls.map((call, index) => {
        const duration = call.duration_seconds !== null ? `${call.duration_seconds} сек` : 'N/A';
        const connectionType = call.connection_type || 'N/A';
        
        const isP1Initiator = call.initiator_ip === call.participant1_ip;
        const isP2Initiator = call.initiator_ip === call.participant2_ip;

        return `
        <div class="call-card">
            <div class="call-card-header">
                <div class="call-header-main">
                    ${getCallTypeIcon(call.call_type)}
                    <h5>#${index + 1}</h5>
                    <div class="call-meta">
                        <span><span class="icon icon-time">${ICONS.clock}</span> ${formatDate(call.call_started_at)}</span>
                        <span><span class="icon icon-time">${ICONS.hourglass}</span> ${duration}</span>
                    </div>
                </div>
                <span class="connection-type-badge ${connectionType.toLowerCase()}">${connectionType}</span>
            </div>
            <div class="participants-grid">
                ${renderParticipantDetails(call.participant1_ip, connections, isP1Initiator)}
                ${renderParticipantDetails(call.participant2_ip, connections, isP2Initiator)}
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
        const status = session.status || 'unknown';
        const reason = session.close_reason ? `(${session.close_reason})` : '';

        return `
        <div class="connection-item">
            <div class="connection-summary">
                <div class="summary-info">
                    <code>${session.room_id}</code>
                    <span class="call-count-badge">${session.calls.length}</span>
                    <span class="creator-id">${session.generated_by_user_id || 'N/A'}</span>
                </div>
                <div class="status ${status.toLowerCase()}">${status} ${reason}</div>
            </div>
            <div class="connection-details">
                ${callHistoryHtml}
            </div>
        </div>`;
    }).join('');
}

export function initConnections() {
    connectionsDateInput = document.getElementById('connections-date');
    searchConnectionsBtn = document.getElementById('search-connections-btn');
    connectionsListContainer = document.getElementById('connections-list');
    
    connectionsDateInput.valueAsDate = new Date();

    searchConnectionsBtn.addEventListener('click', loadConnections);
    
    connectionsListContainer.addEventListener('click', (e) => {
        const summary = e.target.closest('.connection-summary');
        if (!summary) return;
        
        const item = summary.parentElement;
        const details = summary.nextElementSibling;
        const isOpen = item.classList.contains('open');

        if (isOpen) {
            details.style.maxHeight = null;
            item.classList.remove('open');
        } else {
            item.classList.add('open');
            details.style.maxHeight = details.scrollHeight + "px";
        }
    });

    loadConnections();
}