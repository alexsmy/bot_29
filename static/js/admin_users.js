// bot_29-main/static/js/admin_users.js
// Этот модуль отвечает за логику раздела "Пользователи".

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let allUsersData = [];
let usersListContainer, userSearchInput;
const API_TOKEN = document.body.dataset.token;

function renderUsers(users) {
    if (users.length === 0) {
        usersListContainer.innerHTML = '<p class="empty-list">Пользователи не найдены.</p>';
        return;
    }
    usersListContainer.innerHTML = users.map(user => {
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
        const displayName = fullName || (user.username ? `@${user.username}` : 'Без имени');
        const isBlocked = user.status === 'blocked';
        
        const blockOrUnblockBtn = isBlocked
            ? `<button class="action-btn unblock-btn" data-user-id="${user.user_id}">Разблокировать</button>`
            : `<button class="action-btn block-btn" data-user-id="${user.user_id}">Заблокировать</button>`;

        const deleteBtn = `<button class="action-btn danger delete-btn" data-user-id="${user.user_id}">Удалить</button>`;

        const actionsHtml = `
            <div class="user-actions">
                ${blockOrUnblockBtn}
                ${deleteBtn}
            </div>
        `;

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

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function handleExport() {
    if (!allUsersData || allUsersData.length === 0) {
        alert("Нет данных для экспорта.");
        return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJSON(allUsersData, `users_export_${timestamp}.json`);
}

async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!Array.isArray(json)) {
                alert("Ошибка: Файл должен содержать массив пользователей.");
                return;
            }
            
            if (!confirm(`Вы собираетесь импортировать ${json.length} пользователей. Существующие записи будут обновлены. Продолжить?`)) {
                return;
            }

            // Отправляем данные на сервер
            const response = await fetch(`/api/admin/users/import?token=${API_TOKEN}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(json)
            });

            if (response.ok) {
                alert("Импорт успешно завершен!");
                loadUsers(); // Обновляем список
            } else {
                const errorData = await response.json();
                alert(`Ошибка импорта: ${errorData.detail || response.statusText}`);
            }

        } catch (error) {
            console.error("Import error:", error);
            alert("Ошибка при чтении или парсинге файла. Убедитесь, что это корректный JSON.");
        }
        // Сбрасываем value, чтобы можно было выбрать тот же файл снова
        event.target.value = '';
    };
    reader.readAsText(file);
}

function setupImportExportButtons() {
    // Находим контейнер фильтров в секции пользователей
    const usersSection = document.getElementById('users');
    const filtersContainer = usersSection.querySelector('.filters');

    if (!filtersContainer) return;

    // Создаем кнопки
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Экспорт JSON';
    exportBtn.className = 'action-btn';
    exportBtn.style.marginLeft = 'auto'; // Сдвигаем вправо
    exportBtn.addEventListener('click', handleExport);

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Импорт JSON';
    importBtn.className = 'action-btn primary';
    importBtn.style.marginLeft = '0.5rem';
    
    // Скрытый input для файла
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleImport);

    importBtn.addEventListener('click', () => fileInput.click());

    filtersContainer.appendChild(exportBtn);
    filtersContainer.appendChild(importBtn);
    filtersContainer.appendChild(fileInput);
}

export function initUsers() {
    usersListContainer = document.getElementById('users-list');
    userSearchInput = document.getElementById('user-search');

    setupImportExportButtons();

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

        // --- ОБНОВЛЕННАЯ ЛОГИКА ОБРАБОТКИ КНОПОК ---
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
            if (confirm(`ВНИМАНИЕ! Вы собираетесь удалить пользователя ID ${userId} и все его данные (действия, сессии). Это действие необратимо. Продолжить?`)) {
                await fetchData(`user/${userId}`, { method: 'DELETE' });
                loadUsers();
            }
            return;
        }
        // --- КОНЕЦ ОБНОВЛЕННОЙ ЛОГИКИ ---

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