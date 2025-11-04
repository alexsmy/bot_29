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
        connectionsListContainer.innerHTML = '<p class="empty-list">Сессии за эту дату не найдены.</p>';
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
            : '<p>Нет информации об участниках в этой сессии.</p>';

        const callHistoryHtml = session.call_history.length > 0
            ? session.call_history.map(call => `
                <div class="call-history-card">
                    <div class="call-header">
                        <span class="call-type ${call.call_type}">${call.call_type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}</span>
                        <span class="call-duration">${call.duration_seconds !== null ? call.duration_seconds + ' сек' : 'N/A'}</span>
                    </div>
                    <div class="call-meta">
                        Начало: ${formatDate(call.call_started_at)}
                    </div>
                    <div class="call-participants-list">
                        <h4>Участники в сессии:</h4>
                        ${participantsHtml}
                    </div>
                </div>
            `).join('')
            : '<p class="empty-list">В этой сессии не было завершенных звонков.</p>';

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

        document.querySelectorAll('.connection-item.open').forEach(openItem => {
            if (openItem !== item) {
                openItem.classList.remove('open');
                openItem.querySelector('.connection-details').style.maxHeight = null;
            }
        });

        if (details.style.maxHeight) {
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