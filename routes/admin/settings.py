# routes/admin/settings.py

from fastapi import APIRouter
from pydantic import BaseModel

import database
from core import CustomJSONResponse

router = APIRouter()

class NotificationSettings(BaseModel):
    notify_on_room_creation: bool
    notify_on_call_start: bool
    notify_on_call_end: bool
    send_connection_report: bool
    notify_on_connection_details: bool

@router.get("/notification_settings", response_class=CustomJSONResponse)
async def get_notification_settings_endpoint():
    """
    Возвращает текущие настройки уведомлений.
    """
    settings = await database.get_notification_settings()
    return settings

@router.post("/notification_settings", response_class=CustomJSONResponse)
async def update_notification_settings_endpoint(settings: NotificationSettings):
    """
    Обновляет настройки уведомлений.
    """
    await database.update_notification_settings(settings.dict())
    return {"status": "ok"}