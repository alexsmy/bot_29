# main.py

import asyncio
import os
import json
import glob
import uuid
import hmac
import hashlib
from urllib.parse import unquote
from datetime import datetime, timedelta, date, timezone
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.responses import HTMLResponse, Response, FileResponse, PlainTextResponse
from fastapi.exception_handlers import http_exception_handler
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

import database
import utils
import ice_provider
import notifier
from logger_config import logger, LOG_FILE_PATH
from config import PRIVATE_ROOM_LIFETIME_HOURS, BOT_TOKEN
from websocket_manager import manager
from routes.websocket import router as websocket_router

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

app.include_router(websocket_router)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if request.url.path.startswith("/api/"):
        return await http_exception_handler(request, exc)
        
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

# --- МОДЕЛИ ДЛЯ MINI APP ---
class UserRequest(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None

class RoomResponse(BaseModel):
    room_id: str
    expires_at: datetime

class InitDataRequest(BaseModel):
    initData: str

class UserData(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None

class ValidationResponse(BaseModel):
    user: UserData
    room: Optional[RoomResponse] = None
# --- КОНЕЦ МОДЕЛЕЙ ---

def is_valid_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    """
    Проверяет подлинность данных, полученных от Telegram Mini App.
    """
    try:
        # Разбираем строку initData
        parsed_data = dict(param.split('=', 1) for param in init_data.split('&'))
        hash_from_telegram = parsed_data.pop('hash')

        # Сортируем ключи и формируем строку для проверки
        sorted_keys = sorted(parsed_data.keys())
        check_string = "\n".join(f"{key}={unquote(parsed_data[key])}" for key in sorted_keys)

        # Вычисляем хэш
        secret_key = hmac.new("WebAppData".encode(), bot_token.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()

        # Сравниваем хэши
        if calculated_hash == hash_from_telegram:
            user_data = json.loads(unquote(parsed_data['user']))
            return user_data
        return None
    except Exception as e:
        logger.error(f"Ошибка валидации initData: {e}")
        return None

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

@app.get("/app", response_class=HTMLResponse)
async def get_mini_app(request: Request):
    return templates.TemplateResponse("mini_app.html", {"request": request})

# --- ОБНОВЛЕННЫЕ МАРШРУТЫ ДЛЯ MINI APP ---
@app.post("/api/auth/validate_user", response_model=ValidationResponse)
async def validate_user_data(request: InitDataRequest):
    user_data = is_valid_init_data(request.initData, BOT_TOKEN)
    
    if not user_data:
        logger.warning("Mini App: Попытка входа с невалидными данными.")
        raise HTTPException(status_code=403, detail="Invalid or outdated data")

    user_id = user_data['id']
    logger.info(f"Mini App: Успешная валидация для user_id: {user_id}")
    
    # Проверяем наличие активной комнаты
    active_room = await database.get_active_room_by_user(user_id)
    
    return ValidationResponse(
        user=UserData(**user_data),
        room=RoomResponse(**active_room) if active_room else None
    )

@app.post("/api/room/status", response_model=RoomResponse)
async def get_room_status(user_request: UserRequest):
    logger.info(f"Mini App: Запрос статуса комнаты для user_id: {user_request.user_id}")
    active_room = await database.get_active_room_by_user(user_request.user_id)
    if not active_room:
        raise HTTPException(status_code=404, detail="Active room not found for this user")
    return RoomResponse(**active_room)

@app.post("/api/room/create", response_model=RoomResponse)
async def create_room_from_app(user_request: UserRequest):
    user_id = user_request.user_id
    logger.info(f"Mini App: Запрос на создание комнаты от user_id: {user_id}")

    await database.log_user(user_id, user_request.first_name, user_request.last_name, user_request.username)
    await database.log_bot_action(user_id, "create_room_from_mini_app")

    room_id = str(uuid.uuid4())
    lifetime_hours = PRIVATE_ROOM_LIFETIME_HOURS
    
    await manager.get_or_create_room(room_id, lifetime_hours=lifetime_hours)

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(hours=lifetime_hours)
    await database.log_call_session(room_id, user_id, created_at, expires_at)

    logger.info(f"Mini App: Создана комната {room_id} для user_id: {user_id}")
    return RoomResponse(room_id=room_id, expires_at=expires_at)
# --- КОНЕЦ ОБНОВЛЕННЫХ МАРШРУТОВ ---

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

async def verify_admin_token(request: Request, token: str):
    expires_at = await database.get_admin_token_expiry(token)
    if not expires_at:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or expired token")
    request.state.token_expires_at = expires_at
    return token

@app.get("/admin/{token}", response_class=HTMLResponse)
async def get_admin_page(request: Request, token: str = Depends(verify_admin_token)):
    expires_at_iso = request.state.token_expires_at.isoformat()
    return templates.TemplateResponse("admin.html", {"request": request, "token": token, "expires_at": expires_at_iso})

@app.get("/api/admin/stats")
async def get_admin_stats(period: str = "all", token: str = Depends(verify_admin_token)):
    stats = await database.get_stats(period)
    return CustomJSONResponse(content=stats)

@app.get("/api/admin/users")
async def get_admin_users(token: str = Depends(verify_admin_token)):
    users = await database.get_users_info()
    return CustomJSONResponse(content=users)

@app.get("/api/admin/user_actions/{user_id}")
async def get_admin_user_actions(user_id: int, token: str = Depends(verify_admin_token)):
    actions = await database.get_user_actions(user_id)
    return CustomJSONResponse(content=actions)

@app.get("/api/admin/connections")
async def get_admin_connections(date: str, token: str = Depends(verify_admin_token)):
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    connections = await database.get_connections_info(date_obj)
    return CustomJSONResponse(content=connections)

@app.get("/api/admin/active_rooms")
async def get_active_rooms(token: str = Depends(verify_admin_token)):
    active_sessions_from_db = await database.get_all_active_sessions()
    
    active_rooms_info = []
    for session in active_sessions_from_db:
        created_at = session['created_at']
        expires_at = session['expires_at']
        room_id = session['room_id']

        lifetime_seconds = (expires_at - created_at).total_seconds()
        lifetime_hours = round(lifetime_seconds / 3600)
        
        remaining_seconds = (expires_at - datetime.now(timezone.utc)).total_seconds()
        
        is_admin_room = lifetime_hours > PRIVATE_ROOM_LIFETIME_HOURS
        
        user_count = 0
        if room_id in manager.rooms:
            user_count = len(manager.rooms[room_id].users)

        active_rooms_info.append({
            "room_id": room_id,
            "lifetime_hours": lifetime_hours,
            "remaining_seconds": max(0, remaining_seconds),
            "is_admin_room": is_admin_room,
            "user_count": user_count,
            "call_status": session.get('status'),
            "call_type": session.get('call_type')
        })
        
    return CustomJSONResponse(content=active_rooms_info)

@app.delete("/api/admin/room/{room_id}")
async def close_room_by_admin(room_id: str, token: str = Depends(verify_admin_token)):
    if room_id in manager.rooms:
        logger.info(f"Администратор принудительно закрывает комнату (из памяти): {room_id}")
        await manager.close_room(room_id, "Closed by admin")
    else:
        logger.info(f"Администратор принудительно закрывает комнату (из БД): {room_id}")
        await database.log_room_closure(room_id, "Closed by admin")
        
    return CustomJSONResponse(content={"status": "room closed", "room_id": room_id})

@app.get("/api/admin/notification_settings")
async def get_notification_settings_endpoint(token: str = Depends(verify_admin_token)):
    settings = await database.get_notification_settings()
    return CustomJSONResponse(content=settings)

@app.post("/api/admin/notification_settings")
async def update_notification_settings_endpoint(settings: NotificationSettings, token: str = Depends(verify_admin_token)):
    await database.update_notification_settings(settings.dict())
    return CustomJSONResponse(content={"status": "ok"})

def sanitize_filename(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return filename

@app.get("/api/admin/reports")
async def list_reports(token: str = Depends(verify_admin_token)):
    try:
        files = glob.glob(os.path.join(LOGS_DIR, "*.html"))
        filenames = sorted([os.path.basename(f) for f in files], reverse=True)
        return CustomJSONResponse(content=filenames)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reports: {e}")

@app.get("/admin/reports/{filename}")
async def get_report(filename: str, download: bool = False, token: str = Depends(verify_admin_token)):
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(LOGS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found.")
    
    headers = {}
    if download:
        headers["Content-Disposition"] = f"attachment; filename={safe_filename}"
        
    return FileResponse(path=filepath, headers=headers, media_type='text/html')

@app.delete("/api/admin/reports/{filename}")
async def delete_report(filename: str, token: str = Depends(verify_admin_token)):
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(LOGS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found.")
    try:
        os.remove(filepath)
        return CustomJSONResponse(content={"status": "deleted", "filename": safe_filename})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {e}")

@app.delete("/api/admin/reports")
async def delete_all_reports(token: str = Depends(verify_admin_token)):
    try:
        files = glob.glob(os.path.join(LOGS_DIR, "*.html"))
        for f in files:
            os.remove(f)
        return CustomJSONResponse(content={"status": "all deleted", "count": len(files)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete all reports: {e}")

@app.get("/api/admin/logs", response_class=PlainTextResponse)
async def get_app_logs(token: str = Depends(verify_admin_token)):
    try:
        if not os.path.exists(LOG_FILE_PATH):
            return "Файл логов еще не создан."
        with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Ошибка чтения файла логов: {e}")
        raise HTTPException(status_code=500, detail="Could not read log file.")

@app.get("/api/admin/logs/download")
async def download_app_logs(token: str = Depends(verify_admin_token)):
    if not os.path.exists(LOG_FILE_PATH):
        raise HTTPException(status_code=404, detail="Log file not found.")
    try:
        with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(
            content=content,
            media_type='text/plain',
            headers={"Content-Disposition": "attachment; filename=app.log"}
        )
    except Exception as e:
        logger.error(f"Ошибка при чтении файла логов для скачивания: {e}")
        raise HTTPException(status_code=500, detail="Could not read log file for download.")

@app.delete("/api/admin/logs")
async def clear_app_logs(token: str = Depends(verify_admin_token)):
    try:
        if os.path.exists(LOG_FILE_PATH):
            with open(LOG_FILE_PATH, 'w') as f:
                f.truncate(0)
            logger.info("Файл логов был очищен администратором.")
            return CustomJSONResponse(content={"status": "log file cleared"})
        return CustomJSONResponse(content={"status": "log file not found"})
    except Exception as e:
        logger.error(f"Ошибка при очистке файла логов: {e}")
        raise HTTPException(status_code=500, detail="Could not clear log file.")

@app.delete("/api/admin/database")
async def clear_database(token: str = Depends(verify_admin_token)):
    try:
        await database.clear_all_data()
        return CustomJSONResponse(content={"status": "database cleared successfully"})
    except Exception as e:
        logger.error(f"Ошибка при очистке базы данных: {e}")
        raise HTTPException(status_code=500, detail=f"Database clearing failed: {e}")

@app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
async def catch_all_invalid_paths(request: Request, full_path: str):
    logger.warning(f"Обработан невалидный путь (catch-all): /{full_path}")
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse(
        "invalid_link.html",
        {"request": request, "bot_username": bot_username},
        status_code=status.HTTP_404_NOT_FOUND
    )