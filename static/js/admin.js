document.addEventListener('DOMContentLoaded', () => {
    const API_TOKEN = document.body.dataset.token;
    let statsChart = null;
    let allUsersData = [];
    let autoUpdateInterval = null;

    // --- UTILS ---
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

    // --- THEME ---
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.add(currentTheme);

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
        updateChartTheme(newTheme);
    });

    // --- NAVIGATION ---
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
            
            // <<< НАЧАЛО ИЗМЕНЕНИЙ >>>
            // Закрываем мобильное меню при клике на ссылку
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
            // <<< КОНЕЦ ИЗМЕНЕНИЙ >>>
        });
    });
    
    // <<< НАЧАЛО ИЗМЕНЕНИЙ: Логика мобильного меню >>>
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

    mobileMenuBtn.addEventListener('click', openMobileMenu);
    sidebarOverlay.addEventListener('click', closeMobileMenu);
    // <<< КОНЕЦ ИЗМЕНЕНИЙ >>>


    // --- TOKEN TIMER ---
    const tokenTimerEl = document.getElementById('token-timer');
    let tokenLifetime = 3600; // 60 minutes in seconds
    const updateTokenTimer = () => {
        tokenLifetime--;
        if (tokenLifetime <= 0) {
            tokenTimerEl.textContent = 'Истёк!';
            clearInterval(tokenInterval);
            return;
        }
        tokenTimerEl.textContent = formatRemainingTime(tokenLifetime).substring(3); // Show only MM:SS
    };
    const tokenInterval = setInterval(updateTokenTimer, 1000);

    // --- STATS ---
    const statsContainer = document.getElementById('stats-container');
    const statsPeriodSelect = document.getElementById('stats-period');
    const statsCanvas = document.getElementById('statsChart');

    const renderStats = (data) => {
        statsContainer.innerHTML = `
            <div class="stat-card"><div class="value">${data.total_users}</div><div class="label">Пользователей</div></div>
            <div class="stat-card"><div class="value">${data.total_actions}</div><div class="label">Действий в боте</div></div>
            <div class="stat-card"><div class="value">${data.total_sessions_created}</div><div class="label">Ссылок создано</div></div>
            <div class="stat-card"><div class="value">${data.completed_calls}</div><div class="label">Успешных звонков</div></div>
            <div class="stat-card"><div class="value">${data.avg_call_duration}</div><div class="label">Средняя длит. (сек)</div></div>
        `;
    };

    const createOrUpdateChart = (data) => {
        const chartData = {
            labels: ['Пользователи', 'Действия', 'Ссылки', 'Звонки'],
            datasets: [{
                label: 'Количество',
                data: [data.total_users, data.total_actions, data.total_sessions_created, data.completed_calls],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.5)',
                    'rgba(245, 158, 11, 0.5)',
                    'rgba(34, 197, 94, 0.5)',
                    'rgba(139, 92, 246, 0.5)'
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(34, 197, 94, 1)',
                    'rgba(139, 92, 246, 1)'
                ],
                borderWidth: 1
            }]
        };

        const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = theme === 'dark' ? '#e4e4e7' : '#1e293b';

        if (statsChart) {
            statsChart.data = chartData;
            statsChart.options.scales.y.grid.color = gridColor;
            statsChart.options.scales.x.grid.color = gridColor;
            statsChart.options.scales.y.ticks.color = textColor;
            statsChart.options.scales.x.ticks.color = textColor;
            statsChart.options.plugins.legend.labels.color = textColor;
            statsChart.update();
        } else {
            statsChart = new Chart(statsCanvas, {
                type: 'bar',
                data: chartData,
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: textColor }
                        },
                        title: {
                            display: true,
                            text: 'Общая статистика',
                            color: textColor
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        },
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        }
                    }
                }
            });
        }
    };
    
    const updateChartTheme = (theme) => {
        if (!statsChart) return;
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = theme === 'dark' ? '#e4e4e7' : '#1e293b';
        statsChart.options.scales.y.grid.color = gridColor;
        statsChart.options.scales.x.grid.color = gridColor;
        statsChart.options.scales.y.ticks.color = textColor;
        statsChart.options.scales.x.ticks.color = textColor;
        statsChart.options.plugins.legend.labels.color = textColor;
        statsChart.options.plugins.title.color = textColor;
        statsChart.update();
    };

    const loadStats = async () => {
        const period = statsPeriodSelect.value;
        const data = await fetchData(`stats?period=${period}`);
        if (data) {
            renderStats(data);
            createOrUpdateChart(data);
        }
    };
    statsPeriodSelect.addEventListener('change', loadStats);

    // --- ACTIVE ROOMS ---
    const adminRoomsContainer = document.getElementById('admin-rooms-list');
    const userRoomsContainer = document.getElementById('user-rooms-list');

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
        const adminRooms = rooms.filter(r => r.is_admin_room);
        const userRooms = rooms.filter(r => !r.is_admin_room);

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
            renderRooms(rooms);
        }
    };

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

    // --- USERS ---
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
                    detailsContainer.innerHTML = '<ul>' + actions.map(action => `
                        <li><strong>${action.action}</strong> - ${formatDate(action.timestamp)}</li>`).join('') + '</ul>';
                } else {
                    detailsContainer.innerHTML = '<p>Действий не найдено.</p>';
                }
            }
        }
    });

    // --- CONNECTIONS ---
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

    // --- NOTIFICATIONS ---
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

    // --- REPORTS ---
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

    // --- LOGS ---
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

    // --- DANGER ZONE ---
    document.getElementById('wipe-db-btn').addEventListener('click', async () => {
        if (confirm('ВЫ УВЕРЕНЕНЫ, ЧТО ХОТИТЕ ПОЛНОСТЬЮ ОЧИСТИТЬ БАЗУ ДАННЫХ?')) {
            await fetchData('database', { method: 'DELETE' });
            alert('База данных очищена. Страница будет перезагружена.');
            window.location.reload();
        }
    });

    // --- INITIAL LOAD & AUTO-UPDATE ---
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