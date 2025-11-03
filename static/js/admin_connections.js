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
        // Генерируем HTML для всех звонков внутри одной сессии
        const callGroupsHtml = session.call_groups.length > 0
            ? session.call_groups.map((call, groupIndex) => {
                
                // Генерируем HTML для участников КОНКРЕТНОГО звонка
                const participantsHtml = call.participants.map((p, pIndex) => `
                    <div class="participant-card">
                        <strong>Участник ${pIndex + 1}</strong>
                        <p><strong>IP:</strong> ${p.ip_address} (${p.country || 'N/A'}, ${p.city || 'N/A'})</p>
                        <p><strong>Устройство:</strong> ${p.device_type}, ${p.os_info}, ${p.browser_info}</p>
                    </div>
                `).join('');

                const callMetaHtml = `
                    <div class="call-group-meta">
                        <span>Тип: <strong>${call.call_type || 'N/A'}</strong></span>
                        <span>Длительность: <strong>${call.duration_seconds === null ? 'активен' : `${call.duration_seconds} сек`}</strong></span>
                        ${call.connection_type ? `<span>Соединение: <strong class="conn-type conn-type-${call.connection_type}">${call.connection_type.toUpperCase()}</strong></span>` : ''}
                    </div>
                `;

                return `
                    <div class="call-group">
                        <div class="call-group-header">Звонок #${groupIndex + 1} &middot; ${formatDate(call.start_time)}</div>
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