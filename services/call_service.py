import asyncio
from datetime import datetime, timezone

import database
import notifier
from websocket_manager import RoomManager

async def start_call(room: RoomManager, caller_id: str, target_id: str, call_type: str):
    room.pending_call_type = call_type
    await room.set_user_status(caller_id, "busy")
    await room.set_user_status(target_id, "busy")
    
    message_to_target = {
        "type": "incoming_call",
        "data": {
            "from": caller_id,
            "from_user": room.users.get(caller_id),
            "call_type": call_type
        }
    }
    await room.send_personal_message(message_to_target, target_id)
    room.start_call_timeout(caller_id, target_id)

async def accept_call(room: RoomManager, acceptor_id: str, caller_id: str):
    room.cancel_call_timeout(acceptor_id, caller_id)
    
    if room.pending_call_type:
        room.details_notification_sent = False
        
        initiator = room.users.get(caller_id)
        receiver = room.users.get(acceptor_id)
        
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
        
    await room.send_personal_message({"type": "call_accepted", "data": {"from": acceptor_id}}, caller_id)

async def end_call(room: RoomManager, initiator_id: str, target_id: str, is_hangup: bool):
    room.cancel_call_timeout(initiator_id, target_id)
    room.details_notification_sent = False
    
    if is_hangup:
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
    await room.set_user_status(initiator_id, "available")
    await room.set_user_status(target_id, "available")

async def process_webrtc_signal(room: RoomManager, sender_id: str, message: dict):
    target_id = message["data"]["target_id"]
    message["data"]["from"] = sender_id
    await room.send_personal_message(message, target_id)

async def process_connection_established(room: RoomManager, connection_type: str):
    if not connection_type or room.details_notification_sent:
        return
        
    room.details_notification_sent = True
    asyncio.create_task(database.update_call_connection_type(room.room_id, connection_type))

    async def send_details_notification():
        await asyncio.sleep(1)
        details = await database.get_call_participants_details(room.room_id)
        if not details:
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