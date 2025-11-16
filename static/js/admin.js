import { initApi } from './admin_api.js';
import { initUi } from './admin_ui.js';
import { initStats, loadStats } from './admin_stats.js';
import { initRooms, loadActiveRooms } from './admin_rooms.js';
import { initUsers } from './admin_users.js';
import { initConnections } from './admin_connections.js';
import { initExplorer } from './admin_explorer.js';
import { initDangerZone } from './admin_danger_zone.js';

document.addEventListener('DOMContentLoaded', () => {
    const API_TOKEN = document.body.dataset.token;
    const TOKEN_EXPIRES_AT_ISO = document.body.dataset.tokenExpiresAt;

    initApi(API_TOKEN);
    initUi(TOKEN_EXPIRES_AT_ISO);

    initStats();
    initRooms();
    initUsers();
    initConnections();
    initExplorer();
    initDangerZone();

    setInterval(() => {
        // Обновляем только те вкладки, которые не требуют активного взаимодействия
        const activeTab = document.querySelector('.content-section.active')?.id;
        if (activeTab === 'stats' || activeTab === 'rooms') {
            loadStats();
            loadActiveRooms();
        }
    }, 10000);
});