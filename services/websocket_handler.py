import logging
from fastapi import WebSocket, WebSocketDisconnect
from configurable_logger import log
from websocket_manager import RoomManager
from services import call_service

async def handle_connection(websocket: WebSocket, room: RoomManager, user_id: str):
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")
            data = message.get("data", {})
            log("WEBSOCKET_EVENT", f"Получено сообщение от {user_id} в комнате {room.room_id}: type={message_type}")

            if message_type == "call_user":
                await call_service.start_call(
                    room, user_id, data["target_id"], data["call_type"]
                )
            elif message_type == "call_accepted":
                await call_service.accept_call(
                    room, user_id, data["target_id"]
                )
            elif message_type in ["offer", "answer", "candidate"]:
                await call_service.process_webrtc_signal(room, user_id, message)
            
            elif message_type == "hangup":
                await call_service.end_call(
                    room, user_id, data["target_id"], is_hangup=True
                )
            elif message_type == "call_declined":
                await call_service.end_call(
                    room, user_id, data["target_id"], is_hangup=False
                )
            elif message_type == "connection_established":
                await call_service.process_connection_established(
                    room, data.get("type")
                )

    except WebSocketDisconnect:
        log("WEBSOCKET_LIFECYCLE", f"WebSocket disconnected for user {user_id} in room {room.room_id}")
    finally:
        # --- ИЗМЕНЕНИЕ: Добавляем логику аварийной сборки ---
        is_in_call = user_id in room.users and room.users[user_id].get("status") == "busy"
        
        if is_in_call:
            # Запускаем аварийную сборку для отключившегося пользователя
            await call_service.handle_abrupt_disconnection(room, user_id)

            other_user_id = None
            for key in list(room.call_timeouts.keys()):
                if user_id in key:
                    other_user_id = key[0] if key[1] == user_id else key[1]
                    room.cancel_call_timeout(user_id, other_user_id)
                    break
            
            if other_user_id and other_user_id in room.users:
                # Завершаем звонок для второго пользователя штатно
                await room.send_personal_message({"type": "call_ended"}, other_user_id)
                await room.set_user_status(other_user_id, "available")
        
        room.details_notification_sent = False
        await room.disconnect(user_id)