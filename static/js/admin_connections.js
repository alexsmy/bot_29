import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let connectionsDateInput, searchConnectionsBtn, connectionsListContainer;

function getDeviceIconHtml(deviceType) {
    let iconSvg = ICONS.device; // Иконка по умолчанию (мобильное устройство)
    let iconClass = 'mobile';
    if (deviceType === 'Desktop') {
        iconSvg = ICONS.desktop;
        iconClass = 'desktop';
    }
    return `<span class="icon icon-device ${iconClass}">${iconSvg}</span>`;
}

function renderParticipantDetails(call, connections, isInitiator) {
    // Определяем, кого мы ищем: инициатора или участника
    // Если есть user_id, используем его для точного сопоставления
    // Если нет (старые записи), используем IP
    
    let conn = null;
    
    if (call.initiator_user_id) {
        // Новая логика: ищем по user_id
        if (isInitiator) {
            conn = connections.find(c => c.user_id === call.initiator_user_id);
        } else {
            conn = connections.find(c => c.user_id !== call.initiator_user_id);
        }
    } else {
        // Старая логика: ищем по IP (fallback)
        const targetIp = isInitiator ? call.initiator_ip : (call.initiator_ip === call.participant1_ip ? call.participant2_ip : call.participant1_ip);
        
        // Пытаемся найти соединение с таким IP. 
        // ВАЖНО: Если IP одинаковые, это может вернуть не того, но для старых записей лучше не сделать.
        // Для новых записей с user_id этот блок не выполнится.
        conn = connections.find(c => c.ip_address === targetIp);
        
        // Если IP одинаковые у обоих, и мы ищем участника, нужно убедиться, что мы не взяли инициатора (если это возможно различить)
        if (!isInitiator && conn && conn.ip_address === call.initiator_ip && connections.length > 1) {
             // Это эвристика: если нашли инициатора, берем другого
             const other = connections.find(c => c !== conn);
             if (other) conn = other;
        }
    }

    const initiatorClass = isInitiator ? 'initiator' : 'receiver';
    const roleTitle = isInitiator ? 'Инициатор' : 'Участник';
    const ipDisplay = conn ? conn.ip_address : (isInitiator ? call.initiator_ip : 'N/A');

    const detailsHtml = conn ? `
        <span>${getDeviceIconHtml(conn.device_type)} ${conn.device_type || 'N/A'}, ${conn.os_info || 'N/A'}, ${conn.browser_info || 'N/A'}</span>
        <span><span class="icon icon-location">${ICONS.location}</span> ${conn.country || 'N/A'}, ${conn.city || 'N/A'}</span>
    ` : '<span><i>Детали подключения не найдены.</i></span>';

    return `
        <div class="participant-column">
            <h6 class="${initiatorClass}">
                <span class="icon icon-person">${ICONS.person}</span>
                <span>${roleTitle}</span>
            </h6>
            <div class="participant-details">
                <span><span class="icon icon-ip">${ICONS.ip}</span> ${ipDisplay}</span>
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
                ${renderParticipantDetails(call, connections, true)}
                ${renderParticipantDetails(call, connections, false)}
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
                    <span>${session.room_id}</span>
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