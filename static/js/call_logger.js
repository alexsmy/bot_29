
/**
 * Централизованный модуль логирования.
 * Использует конфигурацию из call_logger_config.js.
 */

// ИЗМЕНЕНИЕ: Импортируем конфигурацию как модуль.
import { LOG_CONFIG } from './call_logger_config.js';

let _roomId = null;
let _userId = null;
let _isInitialized = false;

/**
 * Инициализирует логгер с данными сессии.
 * @param {string} roomId - ID комнаты.
 * @param {string} [userId] - ID пользователя (может быть установлен позже).
 */
export function init(roomId, userId) {
    _roomId = roomId;
    if (userId) {
        _userId = userId;
    }
    _isInitialized = true;
}

/**
 * Асинхронно отправляет лог на сервер.
 * @param {string} formattedMessage - Отформатированное сообщение для лога.
 */
async function _sendLogToServer(formattedMessage) {
    if (!_isInitialized || !_roomId) return;

    try {
        await fetch('/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: String(_userId || 'pre-id'),
                room_id: String(_roomId),
                message: formattedMessage
            })
        });
    } catch (error) {
        console.error('LOGGER: Failed to send log to server:', error);
    }
}

/**
 * Основная функция логирования.
 * @param {string} category - Категория лога (например, 'WEBSOCKET_LIFECYCLE').
 * @param  {...any} args - Аргументы для вывода, как в console.log.
 */
export function log(category, ...args) {
    let config = null;

    // Ищем категорию в конфигурации
    for (const group in LOG_CONFIG) {
        if (LOG_CONFIG[group][category]) {
            config = LOG_CONFIG[group][category];
            break;
        }
    }

    // Если категория не найдена или выключена, ничего не делаем
    if (!config || (!config.console && !config.server)) {
        return;
    }

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    // Форматируем сообщение для вывода
    const consoleMessage = [`[${time} | ${category}]`, ...args];
    
    // Выводим в консоль, если включено
    if (config.console) {
        console.log(...consoleMessage);
    }

    // Отправляем на сервер, если включено
    if (config.server) {
        // Преобразуем все аргументы в строки для отправки
        const serverMessageString = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Unserializable Object]';
                }
            }
            return String(arg);
        }).join(' ');

        _sendLogToServer(`[${category}] ${serverMessageString}`);
    }
}