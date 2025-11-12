import { initApi } from './admin_api.js';
import { initUi } from './admin_ui.js';
import { initStats, loadStats } from './admin_stats.js';
import { initRooms, loadActiveRooms } from './admin_rooms.js';
import { initUsers } from './admin_users.js';
import { initConnections } from './admin_connections.js';
import { initNotifications } from './admin_notifications.js';
import { initRecording } from './admin_recording.js';
import { initCallRecords } from './admin_call_records.js';
import { initReports } from './admin_reports.js';
import { initLogs } from './admin_logs.js';
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
    initNotifications();
    initRecording();
    initCallRecords();
    initReports();
    initLogs();
    initDangerZone();

    setInterval(() => {
        loadStats();
        loadActiveRooms();
    }, 10000);
});