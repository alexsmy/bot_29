import { initApi } from './admin_api.js';
import { initUi } from './admin_ui.js';
import { initStats, renderStats } from './admin_stats.js';
import { initRooms, handleRoomUpdate, handleRoomAdded, handleRoomRemoved } from './admin_rooms.js';
import { initUsers } from './admin_users.js';
import { initConnections } from './admin_connections.js';
import { initNotifications } from './admin_notifications.js';
import { initReports, handleNewReport, handleReportDeleted, handleReportsCleared } from './admin_reports.js';
import { initLogs, handleLogsCleared } from './admin_logs.js';
import { initDangerZone } from './admin_danger_zone.js';

function connectAdminWebSocket(token) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Admin WebSocket connection established.');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received admin event:', message.event, message.data);

        switch (message.event) {
            case 'ROOM_UPDATE':
                handleRoomUpdate(message.data);
                break;
            case 'ROOM_ADDED':
                handleRoomAdded(message.data);
                break;
            case 'ROOM_REMOVED':
                handleRoomRemoved(message.data);
                break;
            case 'STATS_UPDATE':
                renderStats(message.data);
                break;
            case 'NEW_REPORT':
                handleNewReport(message.data);
                break;
            case 'REPORT_DELETED':
                handleReportDeleted(message.data);
                break;
            case 'REPORTS_CLEARED':
                handleReportsCleared();
                break;
            case 'LOGS_CLEARED':
                handleLogsCleared();
                break;
        }
    };

    ws.onclose = (event) => {
        console.warn('Admin WebSocket connection closed. Attempting to reconnect in 5 seconds.', event.reason);
        setTimeout(() => connectAdminWebSocket(token), 5000);
    };

    ws.onerror = (error) => {
        console.error('Admin WebSocket error:', error);
        ws.close();
    };
}

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
    initReports();
    initLogs();
    initDangerZone();

    // Устанавливаем WebSocket соединение для обновлений в реальном времени
    connectAdminWebSocket(API_TOKEN);
});