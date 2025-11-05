# core/schemas.py

from pydantic import BaseModel
from typing import Dict, Any, Optional, List

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