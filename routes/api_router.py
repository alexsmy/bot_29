import os
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

import notifier
from core import CustomJSONResponse, templates
from logger_config import logger
from websocket_manager import manager

router = APIRouter()

LOGS_DIR = "connection_logs"

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