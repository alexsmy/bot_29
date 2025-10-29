# START OF REPLACEMENT FILE main.py (v2)

import asyncio
import os
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

import database
import utils
import ice_provider

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

PRIVATE_ROOM_LIFETIME_HOURS = 3
ADMIN_TOKEN_LIFETIME_MINUTES = 60

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

class RoomManager:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.max_users = 2
        self.active_connections: Dict[Any, WebSocket] = {}
        self.users: Dict[Any, dict] = {}
        self.call_timeouts: Dict[tuple, asyncio.Task] = {}
        self.creation_time = datetime.utcnow()
        self.pending_call_type: Optional[str] = None

    async def connect(self, websocket: WebSocket, user_data: dict):
        # Prevent more than max_users from being in the room's user list at any time
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

    # MODIFIED: Disconnect now completely removes the user and notifies others.
    async def disconnect(self, user_id: Any):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        if user_id in self.users:
            del self.users[user_id]
            # Notify the remaining user that someone has left.
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
        self.admin_tokens: Dict[str, datetime] = {}

    async def get_or_create_room(self, room_id: str) -> RoomManager:
        if room_id not in self.rooms:
            self.rooms[room_id] = RoomManager(room_id)
            await self.schedule_private_room_cleanup(room_id, PRIVATE_ROOM_LIFETIME_HOURS)
        return self.rooms[room_id]

    async def schedule_private_room_cleanup(self, room_id: str, delay_hours: int):
        cleanup_task = asyncio.create_task(self._cleanup_room_after_delay(room_id, delay_hours))
        self.private_room_cleanup_tasks[room_id] = cleanup_task

    async def _cleanup_room_after_delay(self, room_id: str, delay_hours: int):
        await asyncio.sleep(delay_hours * 3600)
        await self.close_room(room_id, "Room lifetime expired")

    async def close_room(self, room_id: str, reason: str):
        if room_id in self.rooms:
            room = self.rooms[room_id]
            await database.log_room_closure(room_id, reason)

            if reason == "Room lifetime expired":
                await room.broadcast_message({"type": "room_expired"})
            else:
                await room.broadcast_message({"type": "room_closed_by_user"})

            user_ids = list(room.active_connections.keys())
            for user_id in user_ids:
                websocket = room.active_connections.get(user_id)
                if websocket:
                    await websocket.close(code=1000, reason=reason)
                # Disconnect will handle cleanup from room's perspective
                await room.disconnect(user_id)
            
            if room_id in self.rooms:
                del self.rooms[room_id]
        
        if room_id in self.private_room_cleanup_tasks:
            self.private_room_cleanup_tasks[room_id].cancel()
            del self.private_room_cleanup_tasks[room_id]

    def add_admin_token(self, token: str):
        expiry_time = datetime.utcnow() + timedelta(minutes=ADMIN_TOKEN_LIFETIME_MINUTES)
        self.admin_tokens[token] = expiry_time

    def is_admin_token_valid(self, token: str) -> bool:
        if token in self.admin_tokens:
            if datetime.utcnow() < self.admin_tokens[token]:
                return True
            else:
                del self.admin_tokens[token]
        return False

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    await database.init_db()
    log_dir = "connection_logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
        print(f"Создана директория для логов: {log_dir}")

@app.post("/log")
async def receive_log(log: ClientLog):
    print(f"[CLIENT LOG | Room: {log.room_id} | User: {log.user_id}]: {log.message}")
    return JSONResponse(content={"status": "logged"}, status_code=200)

@app.post("/api/log/connection-details")
async def save_connection_log(log_data: ConnectionLog, request: Request):
    try:
        log_dir = "connection_logs"
        timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"conn_log_{timestamp}_room_{log_data.roomId[:8]}.html"
        filepath = os.path.join(log_dir, filename)

        rendered_html = templates.TemplateResponse(
            "connection_log_template.html",
            {
                "request": request,
                "log": log_data.dict(),
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            }
        ).body.decode("utf-8")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(rendered_html)

        print(f"Лог соединения сохранен в файл: {filepath}")
        return JSONResponse(content={"status": "log saved", "filename": filename})
    except Exception as e:
        print(f"Ошибка при сохранении лога соединения: {e}")
        raise HTTPException(status_code=500, detail="Failed to save connection log")

@app.get("/room/lifetime/{room_id}")
async def get_room_lifetime(room_id: str):
    if room_id not in manager.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = manager.rooms[room_id]
    expiry_time = room.creation_time + timedelta(hours=PRIVATE_ROOM_LIFETIME_HOURS)
    remaining_seconds = (expiry_time - datetime.utcnow()).total_seconds()
    return JSONResponse(content={"remaining_seconds": max(0, remaining_seconds)})

@app.get("/", response_class=HTMLResponse)
async def get_welcome(request: Request):
    bot_name = os.environ.get("BOT_NAME", "Telegram Caller")
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse("welcome.html", {"request": request, "bot_name": bot_name, "bot_username": bot_username})

@app.get("/api/ice-servers")
async def get_ice_servers_endpoint():
    servers = ice_provider.get_ice_servers()
    return JSONResponse(content=servers)

@app.get("/call/{room_id}", response_class=HTMLResponse)
async def get_call_page(request: Request, room_id: str):
    if room_id not in manager.rooms:
        bot_name = os.environ.get("BOT_NAME", "Telegram Caller")
        bot_username = os.environ.get("BOT_USERNAME", "")
        return templates.TemplateResponse("invalid_link.html", {"request": request, "bot_name": bot_name, "bot_username": bot_username}, status_code=404)
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse("call.html", {"request": request, "bot_username": bot_username})

@app.post("/room/close/{room_id}")
async def close_room_endpoint(room_id: str):
    if room_id not in manager.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    await manager.close_room(room_id, "Closed by user")
    return JSONResponse(content={"status": "closing"})

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
                    await database.log_call_start(room.room_id, room.pending_call_type)
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
                    await database.log_call_end(room.room_id)
                    
                await room.send_personal_message({"type": "call_ended"}, target_id)
                await room.set_user_status(user_id, "available")
                await room.set_user_status(target_id, "available")

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user {user_id} in room {room.room_id}")
    finally:
        # This logic handles cases where a user disconnects mid-call
        # It ensures the other user is notified and their status is reset.
        is_in_call = user_id in room.users and room.users[user_id].get("status") == "busy"
        
        if is_in_call:
            # Find the other user in the call
            other_user_id = None
            # Check active calls by looking through timeouts
            for key in list(room.call_timeouts.keys()):
                if user_id in key:
                    other_user_id = key[0] if key[1] == user_id else key[1]
                    room.cancel_call_timeout(user_id, other_user_id)
                    break
            
            if other_user_id and other_user_id in room.users:
                await room.send_personal_message({"type": "call_ended"}, other_user_id)
                await room.set_user_status(other_user_id, "available")

        # MODIFIED: This now fully removes the user and notifies everyone.
        await room.disconnect(user_id)

@app.websocket("/ws/private/{room_id}")
async def websocket_endpoint_private(websocket: WebSocket, room_id: str):
    room = await manager.get_or_create_room(room_id)
    if not room:
        await websocket.close(code=1008, reason="Forbidden: Room not found or expired")
        return

    # MODIFIED: Simplified connection logic. No more reconnect.
    # A new connection is always a new user in the room.
    x_forwarded_for = websocket.headers.get("x-forwarded-for")
    ip_address = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else (websocket.headers.get("x-real-ip") or websocket.client.host)
    user_agent = websocket.headers.get("user-agent", "Unknown")
    location_data = await utils.get_ip_location(ip_address)
    ua_data = utils.parse_user_agent(user_agent)
    parsed_data = {**location_data, **ua_data}
    await database.log_connection(room_id, ip_address, user_agent, parsed_data)

    new_user_id = str(uuid.uuid4())
    user_data = {"id": new_user_id, "first_name": "Собеседник", "last_name": ""}
    
    actual_user_id = await room.connect(websocket, user_data)

    if actual_user_id:
        await handle_websocket_logic(websocket, room, actual_user_id)
    else:
        # If connect returned None (e.g., room is full), the socket is already closed.
        print(f"Connection attempt to full room {room_id} was rejected.")


async def verify_admin_token(token: str):
    if not manager.is_admin_token_valid(token):
        raise HTTPException(status_code=403, detail="Invalid or expired token")
    return token

@app.get("/admin/{token}", response_class=HTMLResponse)
async def get_admin_page(request: Request, token: str = Depends(verify_admin_token)):
    return templates.TemplateResponse("admin.html", {"request": request, "token": token})

@app.get("/api/admin/stats")
async def get_admin_stats(period: str = "all", token: str = Depends(verify_admin_token)):
    stats = await database.get_stats(period)
    return JSONResponse(content=stats)

@app.get("/api/admin/users")
async def get_admin_users(token: str = Depends(verify_admin_token)):
    users = await database.get_users_info()
    return JSONResponse(content=users)

@app.get("/api/admin/user_actions/{user_id}")
async def get_admin_user_actions(user_id: int, token: str = Depends(verify_admin_token)):
    actions = await database.get_user_actions(user_id)
    return JSONResponse(content=actions)

@app.get("/api/admin/connections")
async def get_admin_connections(date: str, token: str = Depends(verify_admin_token)):
    connections = await database.get_connections_info(date)
    return JSONResponse(content=connections)

# END OF REPLACEMENT FILE main.py (v2)