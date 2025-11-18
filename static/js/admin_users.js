import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let allUsersData = [];
let allActionsData = [];
let usersListContainer, userSearchInput, exportBtn, importBtn, importInput;

function renderUserCard(user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    const displayName = (fullName && fullName !== '.') ? fullName : (user.username ? `@${user.username}` : 'Без имени');
    const isBlocked = user.status === 'blocked';
    const actionsCount = allActionsData.filter(a => a.user_id === user.user_id).length;

    const buttonsHtml = isBlocked ? `
        <button class="action-btn success unblock-btn" data-user-id="${user.user_id}" title="Разблокировать">
            <span class="icon">${ICONS.unblock}</span>
        </button>
        <button class="action-btn danger delete-btn" data-user-id="${user.user_id}" title="Удалить">
            <span class="icon">${ICONS.delete}</span>
        </button>
    ` : `
        <button class="action-btn danger block-btn" data-user-id="${user.user_id}" title="Заблокировать">
            <span class="icon">${ICONS.block}</span>
        </button>
        <button class="action-btn danger delete-btn" data-user-id="${user.user_id}" title="Удалить">
            <span class="icon">${ICONS.delete}</span>
        </button>
    `;

    return `
        <div class="user-item ${isBlocked ? 'blocked' : ''}" data-user-id="${user.user_id}">
            <div class="user-item-header">
                <div class="user-info">
                    <div class="user-status-icon">
                        <span class="icon">${isBlocked ? ICONS.block : ICONS.person}</span>
                    </div>
                    <div class="user-name-id">
                        <span class="user-name">${displayName}</span>
                        <span class="user-id">${user.user_id}</span>
                    </div>
                </div>
                <div class="user-meta">
                    <div class="user-meta-item" title="Дата первого визита">
                        <span class="icon">${ICONS.clock}</span>
                        <span>${new Date(user.first_seen).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div class="user-meta-item" title="Количество действий">
                        <span class="icon">${ICONS.stats}</span>
                        <span class="action-count-badge">${actionsCount}</span>
                    </div>
                </div>
                <div class="user-actions">
                    ${buttonsHtml}
                </div>
            </div>
            <div class="user-details"></div>
        </div>
    `;
}

function renderUsers() {
    const searchTerm = userSearchInput.value.trim().toLowerCase();
    const filteredUsers = allUsersData.filter(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const username = (user.username || '').toLowerCase();
        const id = String(user.user_id);
        return fullName.includes(searchTerm) || username.includes(searchTerm) || id.includes(searchTerm);
    });

    if (filteredUsers.length === 0) {
        usersListContainer.innerHTML = '<p class="empty-list">Пользователи не найдены.</p>';
        return;
    }

    usersListContainer.innerHTML = filteredUsers.map(user => renderUserCard(user)).join('');
}

async function loadAndRenderUsers() {
    usersListContainer.innerHTML = '<div class="skeleton-list"></div>';
    const [users, actions] = await Promise.all([
        fetchData('users'),
        fetchData('users/all_actions')
    ]);

    if (users) {
        allUsersData = users;
        allActionsData = actions || [];
        renderUsers();
    } else {
        usersListContainer.innerHTML = '<p class="empty-list">Не удалось загрузить список пользователей.</p>';
    }
}

async function handleImport(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
        const result = await fetch(`/api/admin/users/import?token=${document.body.dataset.token}`, {
            method: 'POST',
            body: formData
        });
        if (result.ok) {
            alert('Данные успешно импортированы!');
            loadAndRenderUsers();
        } else {
            const error = await result.json();
            alert(`Ошибка импорта: ${error.detail}`);
        }
    } catch (error) {
        console.error('Import error:', error);
        alert('Произошла ошибка при загрузке файла.');
    }
    importInput.value = '';
}

export function initUsers() {
    usersListContainer = document.getElementById('users-list');
    userSearchInput = document.getElementById('user-search');
    exportBtn = document.getElementById('export-users-btn');
    importBtn = document.getElementById('import-users-btn');
    importInput = document.getElementById('import-users-input');

    userSearchInput.addEventListener('input', renderUsers);
    exportBtn.addEventListener('click', () => {
        window.location.href = `/api/admin/users/export?token=${document.body.dataset.token}`;
    });
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => handleImport(e.target.files[0]));

    usersListContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('.action-btn');
        if (button) {
            e.stopPropagation();
            const userId = button.dataset.userId;
            if (button.classList.contains('block-btn')) {
                if (confirm(`Заблокировать пользователя ID ${userId}?`)) {
                    await fetchData(`user/${userId}/block`, { method: 'POST' });
                    loadAndRenderUsers();
                }
            } else if (button.classList.contains('unblock-btn')) {
                if (confirm(`Разблокировать пользователя ID ${userId}?`)) {
                    await fetchData(`user/${userId}/unblock`, { method: 'POST' });
                    loadAndRenderUsers();
                }
            } else if (button.classList.contains('delete-btn')) {
                if (confirm(`ВНИМАНИЕ! Вы собираетесь удалить пользователя ID ${userId} и все его данные. Это действие необратимо. Продолжить?`)) {
                    await fetchData(`user/${userId}`, { method: 'DELETE' });
                    loadAndRenderUsers();
                }
            }
            return;
        }

        const header = e.target.closest('.user-item-header');
        if (header) {
            const userItem = header.closest('.user-item');
            const detailsContainer = userItem.querySelector('.user-details');
            const isOpen = userItem.classList.toggle('open');

            if (isOpen) {
                detailsContainer.style.maxHeight = '300px';
                if (!detailsContainer.innerHTML.trim()) {
                    detailsContainer.innerHTML = '<p style="padding: 1rem;">Загрузка действий...</p>';
                    const userId = userItem.dataset.userId;
                    const userActions = allActionsData.filter(a => a.user_id == userId)
                                                     .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                    if (userActions && userActions.length > 0) {
                        const actionsHtml = userActions.map(action => `
                            <div class="action-log-entry">
                                <span class="action-name">${action.action}</span>
                                <span class="action-time">${formatDate(action.timestamp)}</span>
                            </div>
                        `).join('');
                        detailsContainer.innerHTML = `<div class="action-log">${actionsHtml}</div>`;
                    } else {
                        detailsContainer.innerHTML = '<p style="padding: 1rem;">Действий не найдено.</p>';
                    }
                }
                detailsContainer.style.maxHeight = detailsContainer.scrollHeight + 32 + "px";
            } else {
                detailsContainer.style.maxHeight = null;
            }
        }
    });

    loadAndRenderUsers();
}