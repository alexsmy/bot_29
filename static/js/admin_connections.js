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
        const callHistoryHtml = session.call_history && session.call_history.length > 0
            ? session.call_history.map((call, callIndex) => {
                const participantsHtml = call.participants.map((participant, pIndex) => `
                    <div class="participant-card">
                        <strong>Участник ${pIndex + 1}</strong>
                        <p><strong>ID пользователя:</strong> ${participant.user_id.substring(0, 8)}...</p>
                        <p><strong>IP:</strong> ${participant.participant_ip || 'Не определен'}</p>
                        <p><strong>Устройство:</strong> ${participant.participant_device_type}, ${participant.participant_os_info}, ${participant.participant_browser_info}</p>
                        <p><strong>Локация:</strong> ${participant.participant_location || 'Не определена'}</p>
                        <p><strong>Инициатор звонка:</strong> ${participant.is_call_initiator ? 'Да' : 'Нет'}</p>
                    </div>
                `).join('');

                return `
                    <div class="call-group">
                        <div class="call-group-header">Звонок #${call.call_id} &middot; ${formatDate(call.call_start_time)}</div>
                        <div class="call-group-meta">
                            <span>Тип соединения: <strong>${call.connection_type || 'p2p'}</strong></span>
                            <span>Продолжительность: <strong>${call.duration_seconds} сек</strong></span>
                            <span>Участников: <strong>${call.participants.length}</strong></span>
                        </div>
                        ${participantsHtml}
                    </div>
                `;
            }).join('')
            : '<p>История звонков за эту дату не найдена.</p>';

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
                    <h4>История звонков</h4>
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