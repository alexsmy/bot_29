// static/js/admin_connections.js

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let connectionsDateInput, searchConnectionsBtn, connectionsListContainer;

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return 'N/A';
    if (seconds < 60) return `${seconds} сек`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} мин ${remainingSeconds} сек`;
}

async function loadConnections() {
    const date = connectionsDateInput.value;
    if (!date) { alert('Выберите дату'); return; }
    
    connectionsListContainer.innerHTML = '<div class="skeleton-list"></div>';
    const calls = await fetchData(`connections?date=${date}`);
    
    if (!calls || calls.length === 0) {
        connectionsListContainer.innerHTML = '<p class="empty-list">Звонков за эту дату не найдено.</p>';
        return;
    }
    
    connectionsListContainer.innerHTML = calls.map(call => {
        const participantsHtml = call.participants.length > 0
            ? call.participants.map((p, pIndex) => `
                <div class="participant-card">
                    <p><strong>Участник #${pIndex + 1}</strong> (${formatDate(p.connected_at)})</p>
                    <p><strong>IP:</strong> ${p.ip_address} (${p.country || 'N/A'}, ${p.city || 'N/A'})</p>
                    <p><strong>Устройство:</strong> ${p.device_type}, ${p.os_info}, ${p.browser_info}</p>
                </div>
            `).join('')
            : '<p>Информация об участниках этого звонка не найдена.</p>';

        return `
        <div class="call-history-item">
            <div class="call-summary">
                <div class="summary-info">
                    <code>${call.room_id}</code>
                    <div class="summary-meta">
                        <span>Начало: <strong>${formatDate(call.start_time)}</strong></span>
                        <span>Длительность: <strong>${formatDuration(call.duration_seconds)}</strong></span>
                        <span>Тип: <strong>${call.connection_type}</strong></span>
                    </div>
                </div>
                <span class="status ${call.status}">${call.status}</span>
            </div>
            <div class="call-details">
                <div class="details-section">
                    <h4>Участники звонка</h4>
                    ${participantsHtml}
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
        const summary = e.target.closest('.call-summary');
        if (!summary) return;
        
        const item = summary.parentElement;
        const details = summary.nextElementSibling;

        document.querySelectorAll('.call-history-item.open').forEach(openItem => {
            if (openItem !== item) {
                openItem.classList.remove('open');
                openItem.querySelector('.call-details').style.maxHeight = null;
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