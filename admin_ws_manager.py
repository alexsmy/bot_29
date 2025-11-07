# admin_ws_manager.py

import asyncio
import json
from typing import Set, Any
from fastapi import WebSocket
from logger_config import logger

class AdminConnectionManager:
    """
    Управляет активными WebSocket-соединениями для админ-панели.
    """
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        """Принимает новое WebSocket-соединение."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("Новое подключение к админ-панели установлено.")

    def disconnect(self, websocket: WebSocket):
        """Отключает WebSocket-соединение."""
        self.active_connections.remove(websocket)
        logger.info("Подключение к админ-панели закрыто.")

    async def broadcast(self, event: str, data: Any):
        """
        Отправляет событие всем подключенным администраторам.
        """
        if not self.active_connections:
            return

        message = json.dumps({"event": event, "data": data})
        
        # Копируем сет, чтобы избежать проблем при изменении сета во время итерации
        disconnected_websockets = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected_websockets.add(connection)
        
        # Удаляем "мертвые" соединения
        for ws in disconnected_websockets:
            self.active_connections.remove(ws)

# Создаем единственный экземпляр менеджера
admin_manager = AdminConnectionManager()

def broadcast_event(event: str, data: Any):
    """
    Безопасно запускает трансляцию события в фоновом режиме.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(admin_manager.broadcast(event, data))
    except RuntimeError:
        # Если цикл событий не запущен, это может быть вызвано из синхронного контекста.
        # В нашем случае это маловероятно, но лучше обработать.
        asyncio.run(admin_manager.broadcast(event, data))
    except Exception as e:
        logger.error(f"Ошибка при создании задачи для трансляции события '{event}': {e}")