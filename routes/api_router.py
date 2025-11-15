import os
import asyncio
import shutil
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

import database
import notifier
from core import CustomJSONResponse, templates
from logger_config import logger
from websocket_manager import manager
from groq_transcriber import transcribe_audio_file

router = APIRouter()

LOGS_DIR = "connection_logs"
RECORDS_DIR = "call_records"

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

@router.post("/log", response_class=CustomJSONResponse)
async def receive_log(log: ClientLog):
    logger.info(f"[CLIENT LOG | Room: {log.room_id} | User: {log.user_id}]: {log.message}")
    return {"status": "logged"}

@router.post("/api/log/connection-details", response_class=CustomJSONResponse)
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

        return {"status": "log saved", "filename": filename}
    except Exception as e:
        logger.error(f"Ошибка при сохранении лога соединения: {e}")
        raise HTTPException(status_code=500, detail="Failed to save connection log")

@router.get("/room/lifetime/{room_id}", response_class=CustomJSONResponse)
async def get_room_lifetime(room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    expiry_time = room.creation_time + timedelta(hours=room.lifetime_hours)
    remaining_seconds = (expiry_time - datetime.now(timezone.utc)).total_seconds()
    return {"remaining_seconds": max(0, remaining_seconds)}

@router.get("/api/recording/status", response_class=CustomJSONResponse)
async def get_recording_status():
    settings = await database.get_admin_settings()
    is_enabled = settings.get('enable_call_recording', False)
    return {"is_enabled": is_enabled}

@router.post("/api/record/upload", response_class=CustomJSONResponse)
async def upload_recording(
    room_id: str = Form(...),
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        # ИЗМЕНЕНИЕ: Определяем директорию для сохранения
        room = await manager.get_or_restore_room(room_id)
        if room and room.current_call_record_path:
            save_dir = room.current_call_record_path
        else:
            save_dir = RECORDS_DIR
            logger.warning(f"Не найдена активная директория для звонка в комнате {room_id}. Файл будет сохранен в корневую папку записей.")
        
        os.makedirs(save_dir, exist_ok=True)
        
        safe_user_id = "".join(c for c in user_id if c.isalnum() or c in ('-', '_'))
        
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        # ИЗМЕНЕНИЕ: Упрощаем имя файла, т.к. room_id уже есть в имени папки
        filename = f"{timestamp}_{safe_user_id[:8]}.webm"
        filepath = os.path.join(save_dir, filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(f"Аудиозапись сохранена: {filepath}")
        
        message_to_admin = f"🎤 <b>Получена аудиозапись звонка</b>\n\n<b>Файл:</b> <code>{os.path.basename(save_dir)}/{filename}</code>"
        asyncio.create_task(
            notifier.send_admin_notification(message_to_admin, 'notify_on_audio_record', file_path=filepath)
        )
        
        asyncio.create_task(transcribe_audio_file(filepath))
        
        return {"status": "ok", "filename": filename}
    except Exception as e:
        logger.error(f"Ошибка при загрузке аудиозаписи: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload recording")

@router.post("/api/record/screenshot", response_class=CustomJSONResponse)
async def upload_screenshot(
    room_id: str = Form(...),
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        # ИЗМЕНЕНИЕ: Определяем директорию для сохранения
        room = await manager.get_or_restore_room(room_id)
        if room and room.current_call_record_path:
            save_dir = room.current_call_record_path
        else:
            save_dir = RECORDS_DIR
            logger.warning(f"Не найдена активная директория для звонка в комнате {room_id}. Скриншот будет сохранен в корневую папку записей.")

        os.makedirs(save_dir, exist_ok=True)
        
        safe_user_id = "".join(c for c in user_id if c.isalnum() or c in ('-', '_'))
        
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        # ИЗМЕНЕНИЕ: Упрощаем имя файла
        filename = f"{timestamp}_{safe_user_id[:8]}_screenshot.png"
        filepath = os.path.join(save_dir, filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(f"Скриншот сохранен: {filepath}")
        
        message_to_admin = (
            f"🖼️ <b>Получен скриншот экрана</b>\n\n"
            f"<b>Room ID:</b> <code>{room_id}</code>\n"
            f"<b>User ID:</b> <code>{user_id}</code>\n"
            f"<b>Файл:</b> <code>{os.path.basename(save_dir)}/{filename}</code>"
        )
        asyncio.create_task(
            notifier.send_admin_photo_notification(
                caption=message_to_admin,
                setting_key='notify_on_screenshot',
                file_path=filepath
            )
        )
        
        return {"status": "ok", "filename": filename}
    except Exception as e:
        logger.error(f"Ошибка при загрузке скриншота: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload screenshot")