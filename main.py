
import os
import json
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import List, Dict, Optional

import database
import notifier
import utils
from logger_config import logger
from config import BOT_USERNAME, PRIVATE_ROOM_LIFETIME_HOURS
from ice_provider import get_ice_servers

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        self.user_status: Dict[str, str] = {}

    async def get_or_create_room(self, room_id: str, lifetime_hours: int = PRIVATE_ROOM_LIFETIME_HOURS):
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
            logger.info(f"Комната {room_id} создана в менеджере соединений.")
            
            async def close_room_after_delay():
                await asyncio.sleep(lifetime_hours * 3600)
                if room_id in self.rooms:
                    await self.close_room(room_id, "expired")
                    logger.info(f"Комната {room_id} автоматически закрыта по истечении времени.")

            asyncio.create_task(close_room_after_delay())
        return self.rooms[room_id]

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str):
        if room_id not in self.rooms:
            logger.warning(f"Попытка подключения к несуществующей или истекшей комнате: {room_id}")
            await websocket.close(code=1008, reason="Room not found or expired")
            return False
        
        room = self.rooms[room_id]
        if len(room) >= 2:
            logger.warning(f"Попытка подключения к полной комнате: {room_id}")
            await websocket.close(code=1008, reason="Room is full")
            return False

        await websocket.accept()
        room[user_id] = websocket
        self.user_status[user_id] = 'online'
        logger.info(f"Пользователь {user_id} подключился к комнате {room_id}.")
        return True

    async def disconnect(self, room_id: str, user_id: str):
        if room_id in self.rooms and user_id in self.rooms[room_id]:
            del self.rooms[room_id][user_id]
            logger.info(f"Пользователь {user_id} отключился от комнаты {room_id}.")
            if not self.rooms[room_id]:
                del self.rooms[room_id]
                logger.info(f"Комната {room_id} пуста и удалена из менеджера.")
        if user_id in self.user_status:
            del self.user_status[user_id]

    async def broadcast_user_list(self, room_id: str):
        if room_id in self.rooms:
            room = self.rooms[room_id]
            user_list = [{"id": uid, "status": self.user_status.get(uid, 'offline')} for uid in room.keys()]
            message = {"type": "user_list", "data": user_list}
            for user_id, websocket in room.items():
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Ошибка при отправке списка пользователей {user_id} в комнате {room_id}: {e}")

    async def send_personal_message(self, message: dict, recipient_id: str):
        if recipient_id in self.user_status:
            for room in self.rooms.values():
                if recipient_id in room:
                    websocket = room[recipient_id]
                    try:
                        await websocket.send_json(message)
                        return True
                    except Exception as e:
                        logger.error(f"Ошибка при отправке личного сообщения пользователю {recipient_id}: {e}")
                        return False
        return False

    async def close_room(self, room_id: str, reason: str = "closed_by_user"):
        if room_id in self.rooms:
            message = {"type": f"room_{reason}", "data": {"message": f"Room closed: {reason}"}}
            for ws in self.rooms[room_id].values():
                try:
                    await ws.send_json(message)
                    await ws.close()
                except Exception:
                    pass
            del self.rooms[room_id]
            logger.info(f"Комната {room_id} принудительно закрыта. Причина: {reason}")
            await database.log_room_closure(room_id, reason)


app = FastAPI()
manager = ConnectionManager()
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.on_event("startup")
async def startup_event():
    await database.get_pool()
    logger.info("Приложение FastAPI запущено, пул соединений с БД доступен.")

@app.on_event("shutdown")
async def shutdown_event():
    await database.close_pool()
    logger.info("Приложение FastAPI остановлено, пул соединений с БД закрыт.")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("welcome.html", {"request": request, "bot_username": BOT_USERNAME})

@app.get("/call/{room_id}", response_class=HTMLResponse)
async def get_call_page(request: Request, room_id: str):
    session_details = await database.get_call_session_details(room_id)
    if not session_details:
        logger.warning(f"Попытка доступа к недействительной или истекшей комнате: {room_id}")
        return templates.TemplateResponse("invalid_link.html", {"request": request, "bot_username": BOT_USERNAME})

    user_agent_str = request.headers.get("User-Agent", "")
    parsed_ua = utils.parse_user_agent(user_agent_str)
    is_ios = 'iOS' in parsed_ua.get('os', '')
    
    logger.info(f"Запрос страницы для комнаты {room_id}. User-Agent: {user_agent_str}. Is iOS: {is_ios}")

    return templates.TemplateResponse("call.html", {
        "request": request,
        "room_id": room_id,
        "bot_username": BOT_USERNAME,
        "is_ios": is_ios
    })

@app.post("/log")
async def log_message(request: Request):
    data = await request.json()
    logger.info(f"[Client Log] User: {data.get('user_id', 'N/A')}, Room: {data.get('room_id', 'N/A')} - {data.get('message', '')}")
    return {"status": "ok"}

@app.get("/room/lifetime/{room_id}")
async def get_room_lifetime(room_id: str):
    session = await database.get_call_session_details(room_id)
    if not session:
        raise HTTPException(status_code=404, detail="Room not found or expired")
    
    remaining = session['expires_at'] - datetime.now(timezone.utc)
    return {"remaining_seconds": max(0, int(remaining.total_seconds()))}

@app.post("/room/close/{room_id}")
async def close_room_endpoint(room_id: str):
    await manager.close_room(room_id, "closed_by_user")
    return {"status": "Room closure initiated"}

@app.get("/api/ice-servers")
async def api_get_ice_servers():
    servers = get_ice_servers()
    return servers

@app.post("/api/log/connection-details")
async def log_connection_details(request: Request):
    data = await request.json()
    room_id = data.get("roomId")
    user_id = data.get("userId")
    
    if not room_id or not user_id:
        raise HTTPException(status_code=400, detail="Missing roomId or userId")

    report_dir = "connection_reports"
    os.makedirs(report_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"report_{room_id[:8]}_{user_id}_{timestamp}.html"
    file_path = os.path.join(report_dir, filename)

    report_html = templates.get_template("connection_log_template.html").render({
        "log": data,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    })

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(report_html)
    
    logger.info(f"Отчет о соединении для комнаты {room_id} сохранен в {file_path}")

    is_admin_room = str(user_id) == os.environ.get("ADMIN_USER_ID")
    if not is_admin_room:
        message = (
            f"📄 <b>Отчет о качестве соединения</b>\n\n"
            f"<b>User ID:</b> <code>{user_id}</code>\n"
            f"<b>Room ID:</b> <code>{room_id}</code>\n"
            f"<i>Файл с детальным отчетом прикреплен к сообщению.</i>"
        )
        notifier.schedule_notification(message, 'send_connection_report', file_path=file_path)

    return {"status": "ok", "filename": filename}

async def get_admin_token(token: str) -> Optional[str]:
    expiry = await database.get_admin_token_expiry(token)
    if expiry and expiry > datetime.now(timezone.utc):
        return token
    raise HTTPException(status_code=403, detail="Invalid or expired token")

@app.get("/admin/{token}", response_class=HTMLResponse)
async def get_admin_panel(request: Request, token: str = Depends(get_admin_token)):
    expires_at = await database.get_admin_token_expiry(token)
    return templates.TemplateResponse("admin.html", {
        "request": request,
        "token": token,
        "expires_at": expires_at.isoformat()
    })

# ... (остальные эндпоинты админ-панели без изменений) ...
@app.get("/admin/reports/{filename}")
async def get_report(filename: str, download: bool = False, token: str = Depends(get_admin_token)):
    report_path = os.path.join("connection_reports", filename)
    if not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="Report not found")
    
    media_type = "text/html"
    headers = {}
    if download:
        media_type = "application/octet-stream"
        headers["Content-Disposition"] = f"attachment; filename={filename}"

    return FileResponse(report_path, media_type=media_type, headers=headers)

@app.get("/api/admin/stats")
async def get_stats(period: str = "all", token: str = Depends(get_admin_token)):
    stats = await database.get_stats(period)
    return stats

@app.get("/api/admin/active_rooms")
async def get_active_rooms(token: str = Depends(get_admin_token)):
    sessions = await database.get_all_active_sessions()
    now = datetime.now(timezone.utc)
    results = []
    for s in sessions:
        room_id = s['room_id']
        room_users = manager.rooms.get(room_id, {})
        user_count = len(room_users)
        
        call_status = 'pending'
        if user_count == 2:
            user_ids = list(room_users.keys())
            if manager.user_status.get(user_ids[0]) == 'busy' and manager.user_status.get(user_ids[1]) == 'busy':
                call_status = 'active'

        results.append({
            "room_id": room_id,
            "created_at": s['created_at'],
            "remaining_seconds": int((s['expires_at'] - now).total_seconds()),
            "user_count": user_count,
            "call_status": call_status,
            "call_type": s.get('call_type'),
            "is_admin_room": s['expires_at'] - s['created_at'] > timedelta(hours=PRIVATE_ROOM_LIFETIME_HOURS)
        })
    return results

@app.delete("/api/admin/room/{room_id}")
async def close_room_admin(room_id: str, token: str = Depends(get_admin_token)):
    await manager.close_room(room_id, "closed_by_admin")
    return {"status": "ok"}

@app.get("/api/admin/users")
async def get_all_users(token: str = Depends(get_admin_token)):
    users = await database.get_users_info()
    return users

@app.get("/api/admin/user_actions/{user_id}")
async def get_user_actions(user_id: int, token: str = Depends(get_admin_token)):
    actions = await database.get_user_actions(user_id)
    return actions

@app.get("/api/admin/connections")
async def get_connections(date: str, token: str = Depends(get_admin_token)):
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d").date()
        connections = await database.get_connections_info(date_obj)
        return connections
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

@app.get("/api/admin/notification_settings")
async def get_notification_settings(token: str = Depends(get_admin_token)):
    settings = await database.get_notification_settings()
    return settings

@app.post("/api/admin/notification_settings")
async def post_notification_settings(request: Request, token: str = Depends(get_admin_token)):
    settings = await request.json()
    await database.update_notification_settings(settings)
    return {"status": "ok"}

@app.get("/api/admin/reports")
async def list_reports(token: str = Depends(get_admin_token)):
    report_dir = "connection_reports"
    if not os.path.exists(report_dir):
        return []
    files = sorted(os.listdir(report_dir), reverse=True)
    return [f for f in files if f.endswith(".html")]

@app.delete("/api/admin/reports/{filename}")
async def delete_report(filename: str, token: str = Depends(get_admin_token)):
    report_path = os.path.join("connection_reports", filename)
    if os.path.exists(report_path):
        os.remove(report_path)
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="File not found")

@app.delete("/api/admin/reports")
async def delete_all_reports(token: str = Depends(get_admin_token)):
    report_dir = "connection_reports"
    for filename in os.listdir(report_dir):
        os.remove(os.path.join(report_dir, filename))
    return {"status": "ok"}

@app.get("/api/admin/logs")
async def get_logs(token: str = Depends(get_admin_token)):
    try:
        with open("app.log", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "Log file not found."

@app.get("/api/admin/logs/download")
async def download_logs(token: str = Depends(get_admin_token)):
    return FileResponse("app.log", media_type="text/plain", filename="app.log")

@app.delete("/api/admin/logs")
async def clear_logs(token: str = Depends(get_admin_token)):
    with open("app.log", "w") as f:
        f.write("")
    return {"status": "ok"}

@app.delete("/api/admin/database")
async def wipe_database(token: str = Depends(get_admin_token)):
    await database.clear_all_data()
    await database.init_db() # Re-initialize settings
    return {"status": "ok"}

@app.websocket("/ws/private/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    user_id = str(uuid.uuid4())
    
    if not await manager.connect(websocket, room_id, user_id):
        return

    ip_address = websocket.headers.get("x-forwarded-for") or websocket.client.host
    user_agent_str = websocket.headers.get("user-agent", "")
    
    location_data = await utils.get_ip_location(ip_address)
    ua_data = utils.parse_user_agent(user_agent_str)
    
    full_ua_data = {**ua_data, **location_data}
    
    asyncio.create_task(database.log_connection(room_id, ip_address, user_agent_str, full_ua_data))

    await websocket.send_json({"type": "identity", "data": {"id": user_id}})
    await manager.broadcast_user_list(room_id)

    try:
        while True:
            data = await websocket.receive_json()
            target_id = data.get("data", {}).get("target_id")
            
            if data['type'] == 'call_user':
                manager.user_status[user_id] = 'busy'
                manager.user_status[target_id] = 'busy'
                await manager.broadcast_user_list(room_id)
                
                message = {
                    "type": "incoming_call",
                    "data": {
                        "from_user": {"id": user_id},
                        "call_type": data['data']['call_type']
                    }
                }
                await manager.send_personal_message(message, target_id)
                
                is_admin_room = await database.get_room_lifetime_hours(room_id) > PRIVATE_ROOM_LIFETIME_HOURS
                if not is_admin_room:
                    message_to_admin = (
                        f"📞 <b>Начало вызова ({data['data']['call_type']})</b>\n\n"
                        f"<b>Room ID:</b> <code>{room_id}</code>\n"
                        f"<b>Инициатор:</b> <code>{user_id}</code>"
                    )
                    notifier.schedule_notification(message_to_admin, 'notify_on_call_start')
                
                asyncio.create_task(database.log_call_start(room_id, data['data']['call_type']))

            elif data['type'] == 'call_accepted':
                await manager.send_personal_message({"type": "call_accepted", "data": {}}, target_id)

            elif data['type'] == 'call_declined' or data['type'] == 'hangup':
                manager.user_status[user_id] = 'online'
                if target_id in manager.user_status:
                    manager.user_status[target_id] = 'online'
                
                if data['type'] == 'hangup':
                    await manager.send_personal_message({"type": "call_ended", "data": {}}, target_id)
                    asyncio.create_task(database.log_call_end(room_id))
                else: # declined
                    await manager.send_personal_message({"type": "call_missed", "data": {}}, target_id)

                await manager.broadcast_user_list(room_id)

            elif data['type'] in ['offer', 'answer', 'candidate']:
                message = {
                    "type": data['type'],
                    "data": {
                        "from": user_id,
                        **data['data']
                    }
                }
                await manager.send_personal_message(message, target_id)

    except WebSocketDisconnect:
        logger.info(f"WebSocket соединение разорвано для пользователя {user_id} в комнате {room_id}.")
    except Exception as e:
        logger.error(f"Произошла ошибка в WebSocket для пользователя {user_id}: {e}")
    finally:
        # Если пользователь был в звонке, завершаем его для другого участника
        if manager.user_status.get(user_id) == 'busy':
            room = manager.rooms.get(room_id, {})
            other_user_id = next((uid for uid in room if uid != user_id), None)
            if other_user_id:
                await manager.send_personal_message({"type": "call_ended", "data": {}}, other_user_id)
                manager.user_status[other_user_id] = 'online'
                asyncio.create_task(database.log_call_end(room_id))

        await manager.disconnect(room_id, user_id)
        await manager.broadcast_user_list(room_id)