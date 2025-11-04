let ws;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectTimeoutId = null;
let isGracefulDisconnect = false;

// Функция для логирования, которую предоставит основной модуль
let logToServer;

function handleWebSocketReconnect(roomId, handlers) {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logToServer(`[WS] Max reconnect attempts reached. Giving up.`);
        alert("Не удалось восстановить соединение с сервером. Пожалуйста, обновите страницу.");
        return;
    }
    
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    logToServer(`[WS] Will attempt to reconnect in ${delay / 1000} seconds (Attempt ${reconnectAttempts}).`);
    
    reconnectTimeoutId = setTimeout(() => {
        initializeWebSocket(roomId, handlers, logToServer);
    }, delay);
}

export function initializeWebSocket(roomId, handlers, logger) {
    isGracefulDisconnect = false;
    logToServer = logger; // Сохраняем функцию логирования
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/private/${roomId}`;
    logToServer(`[WS] Attempting a new connection.`);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        logToServer("[WS] WebSocket connection established.");
        reconnectAttempts = 0;
        if (reconnectTimeoutId) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
        }
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        logToServer(`[WS] Received message: ${message.type}`);
        
        // Диспетчер сообщений: вызываем нужный обработчик из переданных
        switch (message.type) {
            case 'identity': handlers.onIdentity(message.data); break;
            case 'user_list': handlers.onUserList(message.data); break;
            case 'incoming_call': handlers.onIncomingCall(message.data); break;
            case 'call_accepted': handlers.onCallAccepted(message.data); break;
            case 'offer': handlers.onOffer(message.data); break;
            case 'answer': handlers.onAnswer(message.data); break;
            case 'candidate': handlers.onCandidate(message.data); break;
            case 'call_ended': handlers.onCallEnded(message.data); break;
            case 'call_missed': handlers.onCallMissed(message.data); break;
            case 'room_expired':
            case 'room_closed_by_user':
                handlers.onRoomClosed(message.data);
                break;
        }
    };

    ws.onclose = (event) => {
        logToServer(`[WS] WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        if (isGracefulDisconnect) {
            logToServer("[WS] Disconnect was graceful. No reconnection needed.");
            return;
        }
        
        if (event.code === 1008) {
             alert(`Ошибка подключения: ${event.reason}. Эта ссылка, возможно, уже недействительна.`);
             if (handlers.onFatalError) handlers.onFatalError();
        } else {
            handleWebSocketReconnect(roomId, handlers);
        }
    };

    ws.onerror = (error) => {
        logToServer(`[WS] WebSocket error: ${JSON.stringify(error)}`);
        ws.close();
    };
}

export function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        logToServer(`[WS] Sending message: ${message.type}`);
        ws.send(JSON.stringify(message));
    } else {
        logToServer("[WS] ERROR: Attempted to send message on a closed connection. Message will be lost.");
    }
}

export function setGracefulDisconnect(value) {
    isGracefulDisconnect = value;
}