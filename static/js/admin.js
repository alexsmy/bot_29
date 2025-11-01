document.addEventListener('DOMContentLoaded', () => {
    const API_TOKEN = document.body.dataset.token;
    const TOKEN_EXPIRES_AT_ISO = document.body.dataset.tokenExpiresAt;
    let allUsersData = [];
    let allRoomsData = [];
    let autoUpdateInterval = null;

    const ICONS = {
        sun: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5V1.5H10.5V4.5H12M18.36,7.05L20.48,4.93L19.07,3.5L16.95,5.64L18.36,7.05M19.5,13.5H22.5V12H19.5V13.5M16.95,18.36L19.07,20.48L20.48,19.07L18.36,16.95L16.95,18.36M12,19.5V22.5H13.5V19.5H12M5.64,16.95L3.5,19.07L4.93,20.48L7.05,18.36L5.64,16.95M4.5,12H1.5V13.5H4.5V12M7.05,5.64L4.93,3.5L3.5,4.93L5.64,7.05L7.05,5.64Z" /></svg>`,
        moon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2M12 4A8 8 0 0 1 20 12A8 8 0 0 1 12 20V4Z" /></svg>`,
        gear: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.44 12.99l.06-.58c0-.19-.01-.38-.04-.57l2.12-1.65a.5.5 0 00.13-.68l-2-3.46a.5.5 0 00-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.5.5 0 0014 2h-4a.5.5 0 00-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.5.5 0 00-.61.22l-2 3.46a.5.5 0 00.13.68l2.12 1.65c-.03.19-.04.38-.04.57l.06.58c-.02.19-.03.38-.03.57s.01.38.03.57l-2.12 1.65a.5.5 0 00-.13.68l2 3.46a.5.5 0 00.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65a.5.5 0 00.49.42h4a.5.5 0 00.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1a.5.5 0 00.61-.22l2-3.46a.5.5 0 00-.13-.68l-2.12-1.65c.03-.19.04-.38.04-.57l-.06-.58c.02-.19.03-.38.03-.57s-.01-.38-.03-.57zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/></svg>`,
        menu: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z"/></svg>`,
        stats: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3,21H5V15H3V21M7,21H9V12H7V21M11,21H13V8H11V21M15,21H17V14H15V21M19,21H21V3H19V21Z" /></svg>`,
        rooms: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,10A2,2 0 0,0 10,12C10,13.11 10.9,14 12,14C13.11,14 14,13.11 14,12A2,2 0 0,0 12,10M18,16V14H16V16H18M18,12V10H16V12H18M18,8V6H16V8H18M6,16V14H4V16H6M6,12V10H4V12H6M6,8V6H4V8H6M14,20V18H10V20H14M14,6V4H10V6H14Z" /></svg>`,
        users: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 17V19H2V17S2 13 9 13S16 17 16 17M12.5 7.5A3.5 3.5 0 1 0 9 11A3.5 3.5 0 0 0 12.5 7.5M15.94 13A5.32 5.32 0 0 1 18 17V19H22V17S22 13.37 15.94 13M15 4.5A3.5 3.5 0 1 0 18.5 8A3.5 3.5 0 0 0 15 4.5Z" /></svg>`,
        connections: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5,12A2.5,2.5 0 0,0 19,9.5A2.5,2.5 0 0,0 16.5,7A2.5,2.5 0 0,0 14,9.5A2.5,2.5 0 0,0 16.5,12M9,11A3,3 0 0,0 12,8A3,3 0 0,0 9,5A3,3 0 0,0 6,8A3,3 0 0,0 9,11M16.5,14C14.67,14 11,14.92 11,16.75V19H22V16.75C22,14.92 18.33,14 16.5,14M9,13C6.67,13 2,14.17 2,16.5V19H9V16.75C9,15.9 9.33,14.41 11.33,13.5C10.5,13.17 9.7,13 9,13Z" /></svg>`,
        notifications: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29V4A2,2 0 0,1 12,2A2,2 0 0,1 14,4V4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21" /></svg>`,
        reports: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13.5,16V19H10.5V16H13.5M13.5,10V14H10.5V10H13.5M13,9V3.5L18.5,9H13Z" /></svg>`,
        logs: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5,4H12V2H19V9H17V5.5L12.5,10L10,7.5L5,12.5L3.5,11L10,4.5L12.5,7L16,3.5V4H13.5M5,14H21V20H5V14M7,16V18H19V16H7Z" /></svg>`,
        danger: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" /></svg>`
    };

    const fetchData = async (endpoint, options = {}) => {
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `/api/admin/${endpoint}${separator}token=${API_TOKEN}`;
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json")) {
                return response.json();
            }
            return response.text();
        } catch (error) {
            console.error(`Fetch error for ${endpoint}:`, error);
            return null;
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString('ru-RU', {
            timeZone: 'UTC',
            dateStyle: 'short',
            timeStyle: 'medium'
        });
    };

    const formatRemainingTime = (seconds) => {
        if (seconds <= 0) return '00:00:00';
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const populateIcons = () => {
        document.getElementById('sidebar-header-icon-placeholder').innerHTML = ICONS.gear;
        document.getElementById('mobile-menu-icon-placeholder').innerHTML = ICONS.menu;
        document.getElementById('icon-stats').innerHTML = ICONS.stats;
        document.getElementById('icon-rooms').innerHTML = ICONS.rooms;
        document.getElementById('icon-users').innerHTML = ICONS.users;
        document.getElementById('icon-connections').innerHTML = ICONS.connections;
        document.getElementById('icon-notifications').innerHTML = ICONS.notifications;
        document.getElementById('icon-reports').innerHTML = ICONS.reports;
        document.getElementById('icon-logs').innerHTML = ICONS.logs;
        document.getElementById('icon-danger').innerHTML = ICONS.danger;
    };
    populateIcons();

    const themeToggle = document.getElementById('theme-toggle');
    const themeIconPlaceholder = document.getElementById('theme-icon-placeholder');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.add(savedTheme);
    themeIconPlaceholder.innerHTML = savedTheme === 'dark' ? ICONS.sun : ICONS.moon;

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
        themeIconPlaceholder.innerHTML = newTheme === 'dark' ? ICONS.sun : ICONS.moon;
    });

    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            contentSections.forEach(section => {
                section.classList.toggle('active', section.id === targetId);
            });
            
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    });
    
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const openMobileMenu = () => {
        sidebar.classList.add('is-open');
        sidebarOverlay.classList.add('is-visible');
    };

    const closeMobileMenu = () => {
        sidebar.classList.remove('is-open');
        sidebarOverlay.classList.remove('is-visible');
    };

    mobileMenuBtn.addEventListener('click', () => {
        if (sidebar.classList.contains('is-open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });
    sidebarOverlay.addEventListener('click', closeMobileMenu);

    const tokenTimerEl = document.getElementById('token-timer');
    let tokenLifetime = Math.floor((new Date(TOKEN_EXPIRES_AT_ISO) - new Date()) / 1000);
    const updateTokenTimer = () => {
        tokenLifetime--;
        if (tokenLifetime <= 0) {
            tokenTimerEl.textContent = 'Истёк!';
            clearInterval(tokenInterval);
            return;
        }
        tokenTimerEl.textContent = formatRemainingTime(tokenLifetime).substring(3);
    };
    const tokenInterval = setInterval(updateTokenTimer, 1000);

    const statsContainer = document.getElementById('stats-container');
    const statsPeriodSelect = document.getElementById('stats-period');

    const renderStats = (data) => {
        statsContainer.innerHTML = `
            <div class="stat-card"><div class="value">${data.total_users}</div><div class="label">Пользователей</div></div>
            <div class="stat-card"><div class="value">${data.total_actions}</div><div class="label">Действий в боте</div></div>
            <div class="stat-card"><div class="value">${data.total_sessions_created}</div><div class="label">Ссылок создано</div></div>
            <div class="stat-card"><div class="value">${data.completed_calls}</div><div class="label">Успешных звонков</div></div>
            <div class="stat-card"><div class="value">${data.avg_call_duration}</div><div class="label">Средняя длит. (сек)</div></div>
            <div class="stat-card"><div class="value">${data.active_rooms_count}</div><div class="label">Активных комнат</div></div>
        `;
    };

    const loadStats = async () => {
        const period = statsPeriodSelect.value;
        const data = await fetchData(`stats?period=${period}`);
        if (data) {
            renderStats(data);
        }
    };
    statsPeriodSelect.addEventListener('change', loadStats);

    const adminRoomsContainer = document.getElementById('admin-rooms-list');
    const userRoomsContainer = document.getElementById('user-rooms-list');
    const adminRoomCountEl = document.querySelector('details:nth-of-type(1) summary span');
    const userRoomCountEl = document.querySelector('details:nth-of-type(2) summary span');
    const roomSearchInput = document.getElementById('room-search');

    const getCallStatusIcon = (userCount, callStatus, callType) => {
        if (userCount === 2 && callStatus === 'active') {
            if (callType === 'video') {
                return `<span class="call-status-icon" title="Активный видеозвонок"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z" /></svg></span>`;
            }
            if (callType === 'audio') {
                return `<span class="call-status-icon" title="Активный аудиозвонок"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,3A3,3 0 0,0 9,6V12A3,3 0 0,0 12,15A3,3 0 0,0 15,12V6A3,3 0 0,0 12,3M19,12V13A7,7 0 0,1 5,13V12H3V13A9,9 0 0,0 12,22A9,9 0 0,0 21,13V12H19Z" /></svg></span>`;
            }
        }
        return '';
    };

    const renderRooms = (rooms) => {
        const searchTerm = roomSearchInput.value.trim().toLowerCase();
        const filteredRooms = searchTerm 
            ? rooms.filter(r => r.room_id.toLowerCase().includes(searchTerm))
            : rooms;

        const adminRooms = filteredRooms.filter(r => r.is_admin_room);
        const userRooms = filteredRooms.filter(r => !r.is_admin_room);

        adminRoomCountEl.textContent = adminRooms.length;
        userRoomCountEl.textContent = userRooms.length;

        const renderList = (container, list) => {
            if (list.length === 0) {
                container.innerHTML = '<p class="empty-list">Активных комнат этого типа нет.</p>';
                return;
            }
            container.innerHTML = list.map(room => `
                <div class="room-item">
                    <div class="room-info">
                        <div class="room-id-line">
                            <code>${room.room_id}</code>
                            ${getCallStatusIcon(room.user_count, room.call_status, room.call_type)}
                        </div>
                        <div class="meta">
                            <span>Осталось: ${formatRemainingTime(room.remaining_seconds)}</span> | 
                            <span>Участников: ${room.user_count}</span>
                        </div>
                    </div>
                    <button class="action-btn close-room-btn" data-room-id="${room.room_id}">Закрыть</button>
                </div>
            `).join('');
        };
        renderList(adminRoomsContainer, adminRooms);
        renderList(userRoomsContainer, userRooms);
    };

    const loadActiveRooms = async () => {
        const rooms = await fetchData('active_rooms');
        if (rooms) {
            allRoomsData = rooms;
            renderRooms(allRoomsData);
        }
    };
    
    roomSearchInput.addEventListener('input', () => renderRooms(allRoomsData));

    document.getElementById('rooms').addEventListener('click', async (e) => {
        if (e.target.classList.contains('close-room-btn')) {
            const roomId = e.target.dataset.roomId;
            if (confirm(`Вы уверены, что хотите принудительно закрыть комнату ${roomId}?`)) {
                const result = await fetchData(`room/${roomId}`, { method: 'DELETE' });
                if (result) {
                    loadActiveRooms();
                }
            }
        }
    });

    const usersListContainer = document.getElementById('users-list');
    const userSearchInput = document.getElementById('user-search');

    const renderUsers = (users) => {
        if (users.length === 0) {
            usersListContainer.innerHTML = '<p class="empty-list">Пользователи не найдены.</p>';
            return;
        }
        usersListContainer.innerHTML = users.map(user => {
            const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
            const displayName = fullName || (user.username ? `@${user.username}` : 'Без имени');
            return `
                <div class="user-item" data-user-id="${user.user_id}">
                    <div class="user-summary">
                        <div>
                            <div class="user-name">${displayName}</div>
                            <div class="user-id">ID: ${user.user_id}</div>
                        </div>
                        <div class="user-first-seen">${formatDate(user.first_seen)}</div>
                    </div>
                    <div class="user-details" id="details-${user.user_id}"></div>
                </div>`;
        }).join('');
    };

    const loadUsers = async () => {
        const users = await fetchData('users');
        if (users) {
            allUsersData = users;
            renderUsers(allUsersData);
        }
    };

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
        const userItem = e.target.closest('.user-item');
        if (!userItem) return;
        
        const userId = userItem.dataset.userId;
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

    const connectionsDateInput = document.getElementById('connections-date');
    const searchConnectionsBtn = document.getElementById('search-connections-btn');
    const connectionsListContainer = document.getElementById('connections-list');
    connectionsDateInput.value = new Date().toISOString().split('T')[0];

    searchConnectionsBtn.addEventListener('click', async () => {
        const date = connectionsDateInput.value;
        if (!date) { alert('Выберите дату'); return; }
        connectionsListContainer.innerHTML = '<div class="skeleton-list"></div>';
        const sessions = await fetchData(`connections?date=${date}`);
        if (!sessions || sessions.length === 0) {
            connectionsListContainer.innerHTML = '<p class="empty-list">Соединения за эту дату не найдены.</p>';
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
                : '<p>Нет информации об участниках.</p>';

            return `
            <div class="connection-item">
                <div class="connection-summary">
                    <div class="summary-info">
                        <code>${session.room_id}</code>
                        <div class="meta">
                           Тип: ${session.call_type || 'N/A'} | Длительность: ${session.duration_seconds !== null ? session.duration_seconds + ' сек' : 'N/A'}
                        </div>
                    </div>
                    <span class="status ${session.status}">${session.status}</span>
                </div>
                <div class="connection-details">
                    <h4>Детали сессии</h4>
                    <p><strong>Создана:</strong> ${formatDate(session.created_at)}</p>
                    ${session.closed_at ? `<p><strong>Закрыта:</strong> ${formatDate(session.closed_at)}</p>` : ''}
                    ${session.close_reason ? `<p><strong>Причина:</strong> ${session.close_reason}</p>` : ''}
                    <hr>
                    <h4>Участники</h4>
                    ${participantsHtml}
                </div>
            </div>`;
        }).join('');
    });
    
    connectionsListContainer.addEventListener('click', (e) => {
        const summary = e.target.closest('.connection-summary');
        if (!summary) return;
        
        const details = summary.nextElementSibling;
        const item = summary.parentElement;

        if (details.style.maxHeight) {
            details.style.maxHeight = null;
            item.classList.remove('open');
        } else {
            details.style.maxHeight = details.scrollHeight + "px";
            item.classList.add('open');
        }
    });

    const saveNotificationsBtn = document.getElementById('save-notification-settings');
    const savedIndicator = document.getElementById('settings-saved-indicator');
    const notificationCheckboxes = document.querySelectorAll('.notification-settings-form input[type="checkbox"]');

    const loadNotificationSettings = async () => {
        const settings = await fetchData('notification_settings');
        if (settings) {
            notificationCheckboxes.forEach(checkbox => {
                checkbox.checked = settings[checkbox.name] || false;
            });
        }
    };

    saveNotificationsBtn.addEventListener('click', async () => {
        const payload = {};
        notificationCheckboxes.forEach(checkbox => {
            payload[checkbox.name] = checkbox.checked;
        });

        const result = await fetchData('notification_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (result && result.status === 'ok') {
            savedIndicator.classList.add('visible');
            setTimeout(() => savedIndicator.classList.remove('visible'), 2000);
        } else {
            alert('Не удалось сохранить настройки.');
        }
    });

    const reportsListContainer = document.getElementById('reports-list');
    const deleteAllReportsBtn = document.getElementById('delete-all-reports-btn');

    const loadReports = async () => {
        const files = await fetchData('reports');
        if (files && files.length > 0) {
            reportsListContainer.innerHTML = files.map(filename => `
                <div class="report-item">
                    <a href="/admin/reports/${filename}?token=${API_TOKEN}" target="_blank">${filename}</a>
                    <div class="report-actions">
                        <button class="action-btn" onclick="window.location.href='/admin/reports/${filename}?download=true&token=${API_TOKEN}'">Скачать</button>
                        <button class="action-btn danger" data-filename="${filename}">Удалить</button>
                    </div>
                </div>
            `).join('');
        } else {
            reportsListContainer.innerHTML = '<p class="empty-list">Отчёты не найдены.</p>';
        }
    };

    reportsListContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('danger') && e.target.dataset.filename) {
            const filename = e.target.dataset.filename;
            if (confirm(`Удалить отчёт "${filename}"?`)) {
                await fetchData(`reports/${filename}`, { method: 'DELETE' });
                loadReports();
            }
        }
    });
    
    deleteAllReportsBtn.addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите удалить ВСЕ отчёты?')) {
            await fetchData('reports', { method: 'DELETE' });
            loadReports();
        }
    });

    const logsContent = document.getElementById('logs-content').querySelector('code');
    const loadLogs = async () => {
        const logs = await fetchData('logs');
        logsContent.textContent = logs || 'Файл логов пуст.';
    };
    document.getElementById('refresh-logs-btn').addEventListener('click', loadLogs);
    document.getElementById('download-logs-btn').addEventListener('click', () => {
        window.location.href = `/api/admin/logs/download?token=${API_TOKEN}`;
    });
    document.getElementById('clear-logs-btn').addEventListener('click', async () => {
        if (confirm('Очистить файл логов?')) {
            await fetchData('logs', { method: 'DELETE' });
            loadLogs();
        }
    });

    document.getElementById('wipe-db-btn').addEventListener('click', async () => {
        if (confirm('ВЫ УВЕРЕНЕНЫ, ЧТО ХОТИТЕ ПОЛНОСТЬЮ ОЧИСТИТЬ БАЗУ ДАННЫХ?')) {
            await fetchData('database', { method: 'DELETE' });
            alert('База данных очищена. Страница будет перезагружена.');
            window.location.reload();
        }
    });

    const initialLoad = () => {
        loadStats();
        loadActiveRooms();
        loadUsers();
        loadReports();
        loadLogs();
        loadNotificationSettings();
        
        if (autoUpdateInterval) clearInterval(autoUpdateInterval);
        autoUpdateInterval = setInterval(() => {
            loadStats();
            loadActiveRooms();
        }, 30000);
    };

    initialLoad();
});