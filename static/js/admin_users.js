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
            <div class="user-card-actions">
                <button class="action-btn unblock-btn" data-user-id="${user.user_id}">Разблокировать</button>
                <button class="action-btn danger delete-btn" data-user-id="${user.user_id}">Удалить</button>
            </div>
        ` : `
            <div class="user-card-actions">
                <button class="action-btn block-btn" data-user-id="${user.user_id}">Заблокировать</button>
                <button class="action-btn danger delete-btn" data-user-id="${user.user_id}">Удалить</button>
            </div>
        `;

        return `
            <div class="user-card ${isBlocked ? 'blocked' : ''}" data-user-id="${user.user_id}">
                <div class="user-card-info">
                    <div class="user-card-header">
                        <span class="icon">${ICONS.clock}</span>
                        <span>${formatDate(user.first_seen)}</span>
                    </div>
                    <div class="user-card-body">
                        <div class="user-name">
                            <span class="icon">${ICONS.person}</span>
                            <span>${displayName}</span>
                        </div>
                        <div class="user-id">ID: ${user.user_id}</div>
                    </div>
                </div>
                ${actionsHtml}
            </div>`;
    }).join('');
}

async function loadUsers() {
    const users = await fetchData('users');
    if (users) {
        allUsersData = users;
        const searchTerm = userSearchInput.value.trim().toLowerCase();
        if (searchTerm) {
            const filtered = allUsersData.filter(user => {
                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
                const username = (user.username || '').toLowerCase();
                const id = String(user.user_id);
                return fullName.includes(searchTerm) || username.includes(searchTerm) || id.includes(searchTerm);
            });
            renderUsers(filtered);
        } else {
            renderUsers(allUsersData);
        }
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
        const userId = target.dataset.userId;

        if (!userId) return;

        if (target.classList.contains('block-btn')) {
            e.stopPropagation();
            if (confirm(`Вы уверены, что хотите заблокировать пользователя ID ${userId}?`)) {
                await fetchData(`user/${userId}/block`, { method: 'POST' });
                loadUsers();
            }
            return;
        }

        if (target.classList.contains('unblock-btn')) {
            e.stopPropagation();
            if (confirm(`Вы уверены, что хотите разблокировать пользователя ID ${userId}?`)) {
                await fetchData(`user/${userId}/unblock`, { method: 'POST' });
                loadUsers();
            }
            return;
        }

        if (target.classList.contains('delete-btn')) {
            e.stopPropagation();
            if (confirm(`ВНИМАНИЕ! Вы собираетесь удалить пользователя ID ${userId} и все его данные. Это действие необратимо. Продолжить?`)) {
                await fetchData(`user/${userId}`, { method: 'DELETE' });
                loadUsers();
            }
            return;
        }
    });

    loadUsers();
}