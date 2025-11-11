import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import database
import utils
import notifier
from logger_config import logger
from websocket_manager import manager, RoomManager

router = APIRouter()

async def handle_websocket_logic(websocket: WebSocket, room: RoomManager, user_id: Any):
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "call_user":
                target_id = message["data"]["target_id"]
                call_type = message["data"]["call_type"]
                room.pending_call_type = call_type
                await room.set_user_status(user_id, "busy")
                await room.set_user_status(target_id, "busy")
                await room.send_personal_message(
                    {"type": "incoming_call", "data": {"from": user_id, "from_user": room.users.get(user_id), "call_type": call_type}},
                    target_id
                )
                room.start_call_timeout(user_id, target_id)

            elif message_type == "call_accepted":
                target_id = message["data"]["target_id"] # target_id здесь - это инициатор звонка
                room.cancel_call_timeout(user_id, target_id)
                if room.pending_call_type:
                    room.details_notification_sent = False
                    
                    initiator = room.users.get(target_id)
                    receiver = room.users.get(user_id)
                    
                    p1_ip = initiator.get('ip_address') if initiator else None
                    p2_ip = receiver.get('ip_address') if receiver else None
                    initiator_ip = p1_ip

                    asyncio.create_task(database.log_call_start(
                        room.room_id, 
                        room.pending_call_type,
                        p1_ip,
                        p2_ip,
                        initiator_ip
                    ))
                    
                    message_to_admin = (
                        f"📞 <b>Звонок начался</b>\n\n"
                        f"<b>Room ID:</b> <code>{room.room_id}</code>\n"
                        f"<b>Тип:</b> {room.pending_call_type}\n"
                        f"<b>Время:</b> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    )
                    asyncio.create_task(
                        notifier.send_admin_notification(message_to_admin, 'notify_on_call_start')
                    )
                    room.pending_call_type = None
                await room.send_personal_message({"type": "call_accepted", "data": {"from": user_id}}, target_id)

            elif message_type in ["offer", "answer", "candidate"]:
                target_id = message["data"]["target_id"]
                message["data"]["from"] = user_id
                await room.send_personal_message(message, target_id)

            elif message_type in ["hangup", "call_declined"]:
                target_id = message["data"]["target_id"]
                room.cancel_call_timeout(user_id, target_id)
                room.details_notification_sent = False
                
                if message_type == "hangup":
                    asyncio.create_task(database.log_call_end(room.room_id))
                    message_to_admin = (
                        f"🔚 <b>Звонок завершен</b>\n\n"
                        f"<b>Room ID:</b> <code>{room.room_id}</code>\n"
                        f"<b>Время:</b> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    )
                    asyncio.create_task(
                        notifier.send_admin_notification(message_to_admin, 'notify_on_call_end')
                    )
                    
                await room.send_personal_message({"type": "call_ended"}, target_id)
                await room.set_user_status(user_id, "available")
                await room.set_user_status(target_id, "available")
            
            elif message_type == "connection_established":
                connection_type = message.get("data", {}).get("type")
               
                if connection_type and not room.details_notification_sent:
                    
                    room.details_notification_sent = True
                    
                    asyncio.create_task(database.update_call_connection_type(room.room_id, connection_type))

                    
                    async def send_details_notification():
                        
                        await asyncio.sleep(1) 
                        details = await database.get_call_participants_details(room.room_id)
                        if not details:
                            logger.warning(f"Не удалось получить детали участников для комнаты {room.room_id} для уведомления.")
                            return

                        initiator = details.get("initiator")
                        participant = details.get("participant")

                        def format_participant_info(p_details, p_title):
                            if not p_details:
                                return f"<b>{p_title}:</b>\n<i>Данные не найдены</i>"
                            
                            ip = p_details.get('ip_address', 'N/A')
                            device = f"{p_details.get('device_type', 'N/A')}, {p_details.get('os_info', 'N/A')}, {p_details.get('browser_info', 'N/A')}"
                            location = f"{p_details.get('country', 'N/A')}, {p_details.get('city', 'N/A')}"
                            
                            return (
                                f"<b>{p_title}:</b>\n"
                                f"<b>IP:</b> <code>{ip}</code>\n"
                                f"<b>Устройство:</b> {device}\n"
                                f"<b>Локация:</b> {location}"
                            )

                        initiator_info = format_participant_info(initiator, "Инициатор")
                        participant_info = format_participant_info(participant, "Участник")

                        message_to_admin = (
                            f"👥 <b>Участники звонка в комнате</b> <code>{room.room_id}</code>\n\n"
                            f"{initiator_info}\n\n"
                            f"{participant_info}\n"
                            f"══════════════════\n"
                            f"<b>Тип соединения:</b> {connection_type.upper()}"
                        )
                        
                        await notifier.send_admin_notification(message_to_admin, 'notify_on_connection_details')

                    asyncio.create_task(send_details_notification())


    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id} in room {room.room_id}")
    finally:
        is_in_call = user_id in room.users and room.users[user_id].get("status") == "busy"
        
        if is_in_call:
            other_user_id = None
            for key in list(room.call_timeouts.keys()):
                if user_id in key:
                    other_user_id = key[0] if key[1] == user_id else key[1]
                    room.cancel_call_timeout(user_id, other_user_id)
                    break
            
            if other_user_id and other_user_id in room.users:
                await room.send_personal_message({"type": "call_ended"}, other_user_id)
                await room.set_user_status(other_user_id, "available")
        
        room.details_notification_sent = False
        await room.disconnect(user_id)

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
        await handle_websocket_logic(websocket, room, actual_user_id)
    else:
        logger.warning(f"Connection attempt to full room {room_id} was rejected.")