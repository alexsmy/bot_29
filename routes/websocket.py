

import asyncio
import uuid
import logging
from fastapi import APIRouter, WebSocket

import database
import utils
from websocket_manager import manager
from services import websocket_handler
from configurable_logger import log

router = APIRouter()

@router.websocket("/ws/private/{room_id}")
async def websocket_endpoint_private(websocket: WebSocket, room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        await websocket.close(code=1008, reason="Forbidden: Room not found or expired")
        return

    x_forwarded_for = websocket.headers.get("x-forwarded-for")
    ip_address = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else (websocket.headers.get("x-real-ip") or websocket.client.host)
    user_agent = websocket.headers.get("user-agent", "Unknown")
    
    location_data = await utils.get_ip_location(ip_address)
    ua_data = utils.parse_user_agent(user_agent)
    
    parsed_data = {**location_data, **ua_data}

    asyncio.create_task(database.log_connection(
        room_id, 
        ip_address, 
        user_agent, 
        parsed_data
    ))

    new_user_id = str(uuid.uuid4())
    
    user_data_for_room = {
        "id": new_user_id, 
        "first_name": "Собеседник", 
        "last_name": "",
        "ip_address": ip_address,
        **parsed_data
    }
    
    actual_user_id = await room.connect(websocket, user_data_for_room)

    if actual_user_id:
        await websocket_handler.handle_connection(websocket, room, actual_user_id)
    else:
        log("WEBSOCKET_LIFECYCLE", f"Connection attempt to full room {room_id} was rejected.", level=logging.WARNING)