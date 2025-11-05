# main.py

import asyncio
import os
import json
from datetime import datetime, date, timezone
from typing import Any
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import HTMLResponse, Response, FileResponse
from fastapi.exception_handlers import http_exception_handler
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import database
import ice_provider
import notifier
from logger_config import logger
from websocket_manager import manager
from routes.websocket import router as websocket_router
from routes.admin import router as admin_router  # <-- ДОБАВЛЕНИЕ: Импортируем админ-роутер
from core.schemas import ClientLog, ConnectionLog  # <-- ИЗМЕНЕНИЕ: Импортируем схемы

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

# Подключаем роутеры
app.include_router(websocket_router)
app.include_router(admin_router) # <-- ДОБАВЛЕНИЕ: Подключаем админ-роутер

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

# --- УДАЛЕНИЕ: Pydantic-модели перенесены в core/schemas.py ---

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

# --- УДАЛЕНИЕ: Все эндпоинты /admin/ и /api/admin/ перенесены в routes/admin.py ---

@app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
async def catch_all_invalid_paths(request: Request, full_path: str):
    logger.warning(f"Обработан невалидный путь (catch-all): /{full_path}")
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse(
        "invalid_link.html",
        {"request": request, "bot_username": bot_username},
        status_code=status.HTTP_404_NOT_FOUND
    )