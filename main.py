# main.py

import asyncio
import os
import uuid
import json
import glob
from datetime import datetime, timedelta, date, timezone
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends, status
from fastapi.responses import HTMLResponse, Response, FileResponse, PlainTextResponse
from fastapi.exception_handlers import http_exception_handler
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from config import ADMIN_TOKEN_LIFETIME_MINUTES
import database
import utils
import ice_provider
import notifier
from logger_config import logger, LOG_FILE_PATH
from config import PRIVATE_ROOM_LIFETIME_HOURS

LOGS_DIR = "connection_logs"

class CustomJSONResponse(Response):
    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            default=lambda o: o.isoformat() if isinstance(o, (datetime, date)) else None,
        ).encode("utf-8")

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]:
        logger.warning(f"Перехвачена ошибка {exc.status_code} для URL: {request.url}. Показываем invalid_link.html.")
        bot_username = os.environ.get("BOT_USERNAME", "")
        return templates.TemplateResponse(
            "invalid_link.html",
            {"request": request, "bot_username": bot_username},
            status_code=exc.status_code
        )
    return await http_exception_handler(request, exc)

class ClientLog(BaseModel):
    user_id: str
    room_id: str
    message: str

class ConnectionLog(BaseModel):
    roomId: str
    userId: str
    isCallInitiator: bool
    probeResults: List[Dict[str, Any]]
    selectedConnection: Optional[Dict[str, Any]] = None

class NotificationSettings(BaseModel):
    notify_on_room_creation: bool
    notify_on_call_start: bool
    notify_on_call_end: bool
    send_connection_report: bool

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
            # MODIFIED: Log missed call
            asyncio.create_task(database.log_call_end(self.room_id, caller_id, target_id, status='missed'))
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


manager = ConnectionManager()

@app.post("/log")
async def receive_log(log: ClientLog):
    logger.info(f"[CLIENT LOG | Room: {log.room_id} | User: {log.user_id}]: {log.message}")
    return CustomJSONResponse(content={"status": "logged"}, status_code=200)

@app.post("/api/log/connection-details")
async def save_connection_log(log_data: ConnectionLog, request: Request):
    try:
        os.makedirs(LOGS_DIR, exist_ok=True)
        
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"conn_log_{timestamp}_room_{log_data.roomId[:8]}.html"
        filepath = os.path.join(LOGS_DIR, filename)

        rendered_html = templates.TemplateResponse(
            "connection_log_template.html",
            {
                "request": request,
                "log": log_data.dict(),
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            }
        ).body.decode("utf-8")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(rendered_html)

        logger.info(f"Лог соединения сохранен в файл: {filepath}")
        
        message_to_admin = (
            f"📄 <b>Сформирован отчет о соединении</b>\n\n"
            f"<b>Room ID:</b> <code>{log_data.roomId}</code>"
        )
        asyncio.create_task(
            notifier.send_admin_notification(message_to_admin, 'send_connection_report', file_path=filepath)
        )

        return CustomJSONResponse(content={"status": "log saved", "filename": filename})
    except Exception as e:
        logger.error(f"Ошибка при сохранении лога соединения: {e}")
        raise HTTPException(status_code=500, detail="Failed to save connection log")

@app.get("/room/lifetime/{room_id}")
async def get_room_lifetime(room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    expiry_time = room.creation_time + timedelta(hours=room.lifetime_hours)
    remaining_seconds = (expiry_time - datetime.now(timezone.utc)).total_seconds()
    return CustomJSONResponse(content={"remaining_seconds": max(0, remaining_seconds)})

@app.get("/", response_class=HTMLResponse)
async def get_welcome(request: Request):
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse("welcome.html", {"request": request, "bot_username": bot_username})

@app.get("/api/ice-servers")
async def get_ice_servers_endpoint():
    servers = ice_provider.get_ice_servers()
    return CustomJSONResponse(content=servers)

@app.get("/call/{room_id}", response_class=HTMLResponse)
async def get_call_page(request: Request, room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse("call.html", {"request": request, "bot_username": bot_username})

@app.post("/room/close/{room_id}")
async def close_room_endpoint(room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    await manager.close_room(room_id, "Closed by user")
    return CustomJSONResponse(content={"status": "closing"})

async def handle_websocket_logic(websocket: WebSocket, room: RoomManager, user_id: Any):
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "call_user":
                target_id = message["data"]["target_id"]
                call_type = message["data"]["call_type"]
                room.pending_call_type = call_type
                await room.set_user_status(user_id, "busy")
                await room.set_user_status(target_id, "busy")
                await room.send_personal_message(
                    {"type": "incoming_call", "data": {"from": user_id, "from_user": room.users.get(user_id), "call_type": call_type}},
                    target_id
                )
                room.start_call_timeout(user_id, target_id)

            elif message_type == "call_accepted":
                target_id = message["data"]["target_id"]
                room.cancel_call_timeout(user_id, target_id)
                if room.pending_call_type:
                    # MODIFIED: Use new log_call_start
                    asyncio.create_task(database.log_call_start(room.room_id, room.pending_call_type, user_id, target_id))
                    message_to_admin = (
                        f"📞 <b>Звонок начался</b>\n\n"
                        f"<b>Room ID:</b> <code>{room.room_id}</code>\n"
                        f"<b>Тип:</b> {room.pending_call_type}\n"
                        f"<b>Время:</b> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    )
                    asyncio.create_task(
                        notifier.send_admin_notification(message_to_admin, 'notify_on_call_start')
                    )
                    room.pending_call_type = None
                await room.send_personal_message({"type": "call_accepted", "data": {"from": user_id}}, target_id)

            elif message_type in ["offer", "answer", "candidate"]:
                target_id = message["data"]["target_id"]
                message["data"]["from"] = user_id
                await room.send_personal_message(message, target_id)

            elif message_type in ["hangup", "call_declined"]:
                target_id = message["data"]["target_id"]
                room.cancel_call_timeout(user_id, target_id)
                
                if message_type == "hangup":
                    # MODIFIED: Use new log_call_end
                    asyncio.create_task(database.log_call_end(room.room_id, user_id, target_id, status='completed'))
                    message_to_admin = (
                        f"🔚 <b>Звонок завершен</b>\n\n"
                        f"<b>Room ID:</b> <code>{room.room_id}</code>\n"
                        f"<b>Время:</b> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    )
                    asyncio.create_task(
                        notifier.send_admin_notification(message_to_admin, 'notify_on_call_end')
                    )
                elif message_type == "call_declined":
                    # Log declined call
                    asyncio.create_task(database.log_call_end(room.room_id, user_id, target_id, status='declined'))
                    
                await room.send_personal_message({"type": "call_ended"}, target_id)
                await room.set_user_status(user_id, "available")
                await room.set_user_status(target_id, "available")

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id} in room {room.room_id}")
    finally:
        is_in_call = user_id in room.users and room.users[user_id].get("status") == "busy"
        
        if is_in_call:
            other_user_id = None
            for key in list(room.call_timeouts.keys()):
                if user_id in key:
                    other_user_id = key[0] if key[1] == user_id else key[1]
                    room.cancel_call_timeout(user_id, other_user_id)
                    break
            
            if other_user_id and other_user_id in room.users:
                # MODIFIED: Log call end if the other user was in an active call
                asyncio.create_task(database.log_call_end(room.room_id, user_id, other_user_id, status='ended_by_peer'))
                await room.send_personal_message({"type": "call_ended"}, other_user_id)
                await room.set_user_status(other_user_id, "available")

        await room.disconnect(user_id)

@app.websocket("/ws/private/{room_id}")
async def websocket_endpoint_private(websocket: WebSocket, room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        await websocket.close(code=1008, reason="Forbidden: Room not found or expired")
        return

    x_forwarded_for = websocket.headers.get("x-forwarded-for")
    ip_address = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else (websocket.headers.get("x-real-ip") or websocket.client.host)
    user_agent = websocket.headers.get("user-agent", "Unknown")
    
    new_user_id = str(uuid.uuid4())
    
    async def log_connection_in_background():
        location_data = await utils.get_ip_location(ip_address)
        ua_data = utils.parse_user_agent(user_agent)
        parsed_data = {**location_data, **ua_data}
        # MODIFIED: Pass new_user_id to log_connection
        await database.log_connection(room_id, ip_address, user_agent, parsed_data, new_user_id)

    asyncio.create_task(log_connection_in_background())

    user_data = {"id": new_user_id, "first_name": "Собеседник", "last_name": ""}
    
    actual_user_id = await room.connect(websocket, user_data)

    if actual_user_id:
        await handle_websocket_logic(websocket, room, actual_user_id)
    else:
        logger.warning(f"Connection attempt to full room {room_id} was rejected.")

# ... (rest of the file)