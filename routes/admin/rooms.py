# routes/admin/rooms.py

from datetime import datetime, timezone
from fastapi import APIRouter

import database
from core import CustomJSONResponse
from websocket_manager import manager
from config import PRIVATE_ROOM_LIFETIME_HOURS
from logger_config import logger

router = APIRouter()

@router.get("/active_rooms", response_class=CustomJSONResponse)
async def get_active_rooms():
    """
    Возвращает список всех активных комнат.
    """
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
            "call_type": session.get('call_type'),
            "generated_by_user_id": session.get('generated_by_user_id')
        })
        
    return active_rooms_info

@router.delete("/room/{room_id}", response_class=CustomJSONResponse)
async def close_room_by_admin(room_id: str):
    """
    Принудительно закрывает комнату по ее ID.
    """
    if room_id in manager.rooms:
        logger.info(f"Администратор принудительно закрывает комнату (из памяти): {room_id}")
        await manager.close_room(room_id, "Closed by admin")
    else:
        logger.info(f"Администратор принудительно закрывает комнату (из БД): {room_id}")
        await database.log_room_closure(room_id, "Closed by admin")
        
    return {"status": "room closed", "room_id": room_id}