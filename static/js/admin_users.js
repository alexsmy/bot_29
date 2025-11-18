
// static/js/admin_users.js

// Этот модуль отвечает за логику раздела "Пользователи".

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let allUsersData = [];
let usersListContainer, userSearchInput;

function renderUsers(users) {
    if (users.length === 0) {
        usersListContainer.innerHTML = '<p class="empty-list">Пользователи не найдены.</p>';
        return;
    }
    usersListContainer.innerHTML = users.map(user => {
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
        const displayName = fullName || (user.username ? `@${user.username}` : 'Без имени');
        const isBlocked = user.status === 'blocked';
        
        const actionsHtml = isBlocked ? `
            <div class="user-actions">
                <button class="action-btn unblock-btn" data-user-id="${user.user_id}">Разблокировать</button>
                <button class="action-btn danger delete-btn" data-user-id="${user.user_id}">Удалить</button>
            </div>
        ` : '';

        return `
            <div class="user-item ${isBlocked ? 'blocked' : ''}" data-user-id="${user.user_id}">
                <div class="user-summary-wrapper">
                    <div class="user-summary">
                        <div>
                            <div class="user-name">${displayName}</div>
                            <div class="user-id">ID: ${user.user_id}</div>
                        </div>
                        <div class="user-first-seen">${formatDate(user.first_seen)}</div>
                    </div>
                </div>
                ${actionsHtml}
                <div class="user-details" id="details-${user.user_id}"></div>
            </div>`;
    }).join('');
}

async function loadUsers() {
    const users = await fetchData('users');
    if (users) {
        allUsersData = users;
        renderUsers(allUsersData);
    }
}

export function initUsers() {
    usersListContainer = document.getElementById('users-list');
    userSearchInput = document.getElementById('user-search');

    userSearchInput.addEventListener('input', () => {
        const searchTerm = userSearchInput.value.trim().toLowerCase();
        const filtered = allUsersData.filter(user => {
            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
            const username = (user.username || '').toLowerCase();
            const id = String(user.user_id);
            return fullName.includes(searchTerm) || username.includes(searchTerm) || id.includes(searchTerm);
        });
        renderUsers(filtered);
    });

    usersListContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const userItem = target.closest('.user-item');
        if (!userItem) return;
        
        const userId = userItem.dataset.userId;

        // --- НОВАЯ ЛОГИКА ОБРАБОТКИ КНОПОК ---
        if (target.classList.contains('unblock-btn')) {
            e.stopPropagation(); // Предотвращаем открытие деталей
            if (confirm(`Вы уверены, что хотите разблокировать пользователя ID ${userId}?`)) {
                await fetchData(`user/${userId}/unblock`, { method: 'POST' });
                loadUsers(); // Перезагружаем список для обновления
            }
            return;
        }

        if (target.classList.contains('delete-btn')) {
            e.stopPropagation(); // Предотвращаем открытие деталей
            if (confirm(`ВНИМАНИЕ! Вы собираетесь удалить пользователя ID ${userId} и все его данные (действия, сессии). Это действие необратимо. Продолжить?`)) {
                await fetchData(`user/${userId}`, { method: 'DELETE' });
                loadUsers(); // Перезагружаем список для обновления
            }
            return;
        }
        // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

        // Логика открытия/закрытия деталей
        const detailsContainer = userItem.querySelector('.user-details');
        const isVisible = detailsContainer.style.display === 'block';

        if (isVisible) {
            detailsContainer.style.display = 'none';
        } else {
            detailsContainer.style.display = 'block';
            if (!detailsContainer.innerHTML.trim()) {
                detailsContainer.innerHTML = '<p>Загрузка действий...</p>';
                const actions = await fetchData(`user_actions/${userId}`);
                if (actions && actions.length > 0) {
                    detailsContainer.innerHTML = '<div class="user-details-content"><ul>' + actions.map(action => `
                        <li><strong>${action.action}</strong> - ${formatDate(action.timestamp)}</li>`).join('') + '</ul></div>';
                } else {
                    detailsContainer.innerHTML = '<p>Действий не найдено.</p>';
                }
            }
        }
    });

    loadUsers();
}