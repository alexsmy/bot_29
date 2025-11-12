import * as state from './call_state.js';

function sendLogToServer(message) {
    const s = state.getState();
    // Не отправляем логи, пока не получили ID от сервера
    if (!s.currentUser || !s.currentUser.id || !s.roomId) return;
    
    fetch('/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: String(s.currentUser.id),
            room_id: String(s.roomId),
            message: message
        })
    }).catch(error => console.error('Failed to send log to server:', error));
}

/**
 * Основная функция логирования. Выводит сообщение в консоль и отправляет на сервер.
 * @param {string} message - Сообщение для логирования.
 */
export function log(message) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const logMessage = `[${time}] ${message}`;
    
    console.log(logMessage);
    
    // Не отправляем на сервер "шумные" технические логи для экономии трафика
    const prefixesToIgnore = ['[STATS]', '[DC]', '[WEBRTC]', '[PROBE]', '[SINK]', '[WS]', '[MEDIA]', '[CONTROLS]'];
    const shouldSendToServer = !prefixesToIgnore.some(prefix => message.startsWith(prefix));
    
    if (shouldSendToServer) {
        sendLogToServer(logMessage);
    }
}