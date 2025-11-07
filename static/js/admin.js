import { initApi } from './admin_api.js';
import { initUi } from './admin_ui.js';
import { initStats, loadStats } from './admin_stats.js';
import { initRooms, loadActiveRooms } from './admin_rooms.js';
import { initUsers } from './admin_users.js';
import { initConnections } from './admin_connections.js';
import { initNotifications } from './admin_notifications.js';
import { initReports } from './admin_reports.js';
import { initLogs } from './admin_logs.js';
import { initDangerZone } from './admin_danger_zone.js';

document.addEventListener('DOMContentLoaded', () => {
    const API_TOKEN = document.body.dataset.token;
    const TOKEN_EXPIRES_AT_ISO = document.body.dataset.tokenExpiresAt;

    // 1. Инициализируем API-модуль с токеном
    initApi(API_TOKEN);

    // 2. Инициализируем основной UI (меню, тема, таймер токена)
    initUi(TOKEN_EXPIRES_AT_ISO);

    // 3. Инициализируем каждый раздел админ-панели
    initStats();
    initRooms();
    initUsers();
    initConnections();
    initNotifications();
    initReports();
    initLogs();
    initDangerZone();

    // 4. Настраиваем периодическое обновление данных для динамических разделов
    setInterval(() => {
        // Эти функции экспортируются из своих модулей специально для авто-обновления
        loadStats();
        loadActiveRooms();
        loadUsers();
        LoadConnections();
        LoadReports();
    }, 5000);
});