# websocket_manager.py

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from fastapi import WebSocket

import database
import notifier
from logger_config import logger
from config import PRIVATE_ROOM_LIFETIME_HOURS

class RoomManager:
    def __init__(self, room_id: str, lifetime_hours: int):
        self.room_id = room_id
        self.lifetime_hours = lifetime_hours
        self.max_users = 2
        self.active_connections: Dict[Any, WebSocket] = {}
        self.users: Dict[Any, dict] = {}
        self.call_timeouts: Dict[tuple, asyncio.Task] = {}
        self.creation_time = datetime.now(timezone.utc)
        self.pending_call_type: Optional[str] = None

    async def connect(self, websocket: WebSocket, user_data: dict):
        if len(self.users) >= self.max_users:
            await websocket.close(code=1008, reason="Room is full")
            return None

        await websocket.accept()
        server_user_id = user_data.get("id", str(uuid.uuid4()))
        await websocket.send_json({"type": "identity", "data": {"id": server_user_id}})

        self.active_connections[server_user_id] = websocket
        self.users[server_user_id] = {**user_data, "id": server_user_id, "status": "available"}

        await self.broadcast_user_list()
        return server_user_id

    async def disconnect(self, user_id: Any):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        if user_id in self.users:
            del self.users[user_id]
            await self.broadcast_user_list()

    async def broadcast_user_list(self):
        user_list = list(self.users.values())
        message = {"type": "user_list", "data": user_list}
        await self.broadcast_message(message)

    async def broadcast_message(self, message: dict, exclude_user_id: Any = None):
        for user_id, connection in self.active_connections.items():
            if user_id == exclude_user_id:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                pass

    async def send_personal_message(self, message: dict, user_id: Any):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception:
                pass

    async def set_user_status(self, user_id: Any, status: str):
        if user_id in self.users:
            self.users[user_id]["status"] = status
            await self.broadcast_user_list()

    async def _call_timeout_task(self, caller_id: Any, target_id: Any):
        await asyncio.sleep(60)
        call_key = tuple(sorted((caller_id, target_id)))
        if call_key in self.call_timeouts:
            del self.call_timeouts[call_key]
            await self.send_personal_message({"type": "call_missed"}, caller_id)
            await self.send_personal_message({"type": "call_ended"}, target_id)
            await self.set_user_status(caller_id, "available")
            await self.set_user_status(target_id, "available")

    def start_call_timeout(self, caller_id: Any, target_id: Any):
        call_key = tuple(sorted((caller_id, target_id)))
        self.cancel_call_timeout(caller_id, target_id)
        task = asyncio.create_task(self._call_timeout_task(caller_id, target_id))
        self.call_timeouts[call_key] = task

    def cancel_call_timeout(self, user1_id: Any, user2_id: Any):
        call_key = tuple(sorted((user1_id, user2_id)))
        if call_key in self.call_timeouts:
            self.call_timeouts[call_key].cancel()
            del self.call_timeouts[call_key]

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, RoomManager] = {}
        self.private_room_cleanup_tasks: Dict[str, asyncio.Task] = {}

    async def get_or_restore_room(self, room_id: str) -> Optional[RoomManager]:
        if room_id in self.rooms:
            return self.rooms[room_id]

        session_details = await database.get_call_session_details(room_id)

        if not session_details:
            logger.warning(f"Попытка доступа к несуществующей или истекшей комнате: {room_id}")
            return None

        logger.info(f"Восстанавливаем комнату {room_id} из базы данных...")
        created_at = session_details['created_at']
        expires_at = session_details['expires_at']
        
        lifetime_seconds = (expires_at - created_at).total_seconds()
        lifetime_hours = round(lifetime_seconds / 3600)

        room = RoomManager(room_id, lifetime_hours=lifetime_hours)
        room.creation_time = created_at
        
        self.rooms[room_id] = room
        
        remaining_seconds = (expires_at - datetime.now(timezone.utc)).total_seconds()
        if remaining_seconds > 0:
            cleanup_task = asyncio.create_task(self._cleanup_room_after_delay_seconds(room_id, remaining_seconds))
            self.private_room_cleanup_tasks[room_id] = cleanup_task
        else:
            await self.close_room(room_id, "Room lifetime expired on restore")

        return room

    async def get_or_create_room(self, room_id: str, lifetime_hours: int = PRIVATE_ROOM_LIFETIME_HOURS) -> RoomManager:
        if room_id not in self.rooms:
            self.rooms[room_id] = RoomManager(room_id, lifetime_hours)
            await self.schedule_private_room_cleanup(room_id, lifetime_hours * 3600)
        return self.rooms[room_id]

    async def schedule_private_room_cleanup(self, room_id: str, delay_seconds: int):
        if room_id in self.private_room_cleanup_tasks:
            self.private_room_cleanup_tasks[room_id].cancel()
        
        cleanup_task = asyncio.create_task(self._cleanup_room_after_delay_seconds(room_id, delay_seconds))
        self.private_room_cleanup_tasks[room_id] = cleanup_task

    async def _cleanup_room_after_delay_seconds(self, room_id: str, delay_seconds: int):
        await asyncio.sleep(delay_seconds)
        await self.close_room(room_id, "Room lifetime expired")

    async def close_room(self, room_id: str, reason: str):
        asyncio.create_task(database.log_room_closure(room_id, reason))

        if room_id in self.rooms:
            room = self.rooms[room_id]
            
            if reason == "Room lifetime expired":
                await room.broadcast_message({"type": "room_expired"})
            else:
                await room.broadcast_message({"type": "room_closed_by_user"})

            user_ids = list(room.active_connections.keys())
            for user_id in user_ids:
                websocket = room.active_connections.get(user_id)
                if websocket:
                    try:
                        await websocket.close(code=1000, reason=reason)
                    except Exception:
                        pass
                await room.disconnect(user_id)
            
            del self.rooms[room_id]
        
        if room_id in self.private_room_cleanup_tasks:
            self.private_room_cleanup_tasks[room_id].cancel()
            del self.private_room_cleanup_tasks[room_id]
        
        logger.info(f"Комната {room_id} была закрыта по причине: {reason}")

# Создаем единственный экземпляр менеджера, который будет импортироваться в другие модули
manager = ConnectionManager()