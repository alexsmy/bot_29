# bot_29-main/routes/admin/settings.py
from fastapi import APIRouter
from pydantic import BaseModel

import database
from core import CustomJSONResponse

router = APIRouter()

class AdminSettings(BaseModel):
    notify_on_room_creation: bool
    notify_on_call_start: bool
    notify_on_call_end: bool
    send_connection_report: bool
    notify_on_connection_details: bool
    enable_call_recording: bool
    notify_on_audio_record: bool
    notify_on_dialog_as_file: bool
    notify_on_dialog_as_message: bool
    notify_on_summary_as_file: bool
    notify_on_summary_as_message: bool
    notify_on_screenshot: bool

@router.get("/admin_settings", response_class=CustomJSONResponse)
async def get_admin_settings_endpoint():
    settings = await database.get_admin_settings()
    return settings

@router.post("/admin_settings", response_class=CustomJSONResponse)
async def update_admin_settings_endpoint(settings: AdminSettings):
    await database.update_admin_settings(settings.dict())
    return {"status": "ok"}