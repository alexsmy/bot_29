from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

import database
from core import CustomJSONResponse

router = APIRouter()

# ИЗМЕНЕНИЕ: Модель расширена новыми настройками
class AdminSettings(BaseModel):
    # Уведомления
    notify_on_room_creation: bool
    notify_on_call_start: bool
    notify_on_call_end: bool
    send_connection_report: bool
    notify_on_connection_details: bool
    notify_send_transcriptions: bool
    notify_transcriptions_format: Literal['file', 'message']
    notify_send_summary: bool
    notify_summary_format: Literal['file', 'message']
    
    # Запись и обработка
    enable_call_recording: bool
    enable_transcription: bool
    enable_dialogue_creation: bool
    enable_summary_creation: bool
    audio_bitrate: int = Field(..., ge=8, le=48)


@router.get("/admin_settings", response_class=CustomJSONResponse)
async def get_admin_settings_endpoint():
    settings = await database.get_admin_settings()
    return settings

@router.post("/admin_settings", response_class=CustomJSONResponse)
async def update_admin_settings_endpoint(settings: AdminSettings):
    await database.update_admin_settings(settings.dict())
    return {"status": "ok"}