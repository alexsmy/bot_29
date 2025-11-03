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
        const participantsHtml = session.call_groups.length > 0
            ? session.call_groups.map((group, groupIndex) => {
                return group.participants.map((p, pIndex) => `
                    <div class="participant-card">
                        <strong>Участник ${pIndex + 1} (подключился в ${formatDate(group.start_time)})</strong>
                        <p><strong>IP:</strong> ${p.ip_address} (${p.country || 'N/A'}, ${p.city || 'N/A'})</p>
                        <p><strong>Устройство:</strong> ${p.device_type}, ${p.os_info}, ${p.browser_info}</p>
                    </div>
                `).join('');
            }).join('')
            : '<p>В этой сессии не было зафиксировано подключений участников.</p>';

        // --- НОВАЯ ЛОГИКА ОТОБРАЖЕНИЯ ДЕТАЛЕЙ ЗВОНКА ---
        let callDetailsHtml = '<p>Звонок не состоялся или не был завершен.</p>';
        if (session.status === 'completed' || session.status === 'active') {
            const durationText = session.duration_seconds ? `<strong>${session.duration_seconds} сек</strong>` : '<i>(в процессе)</i>';
            const connectionTypeClass = session.connection_type || 'unknown';
            
            callDetailsHtml = `
                <div class="call-group-meta">
                    <span>Тип: <strong>${session.call_type || 'N/A'}</strong></span>
                    <span>Начало: <strong>${formatDate(session.call_started_at)}</strong></span>
                    <span>Длительность: ${durationText}</span>
                    <span>Соединение: <span class="conn-type ${connectionTypeClass}">${session.connection_type || 'N/A'}</span></span>
                </div>
            `;
        }
        // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

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
                    <h4>Детали звонка</h4>
                    ${callDetailsHtml}
                </div>
                <div class="details-section">
                    <h4>Детали сессии и участники</h4>
                    <p><strong>Сессия создана:</strong> ${formatDate(session.created_at)}</p>
                    ${session.closed_at ? `<p><strong>Сессия закрыта:</strong> ${formatDate(session.closed_at)}</p>` : ''}
                    ${session.close_reason ? `<p><strong>Причина:</strong> ${session.close_reason}</p>` : ''}
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