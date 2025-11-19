import asyncio
import os
import glob
import logging
from datetime import datetime, timezone

import database
import notifier
from websocket_manager import RoomManager
from configurable_logger import log
from groq_transcriber import transcribe_audio_file

RECORDS_DIR = "call_records"

# ... (функция assemble_audio_chunks без изменений) ...
async def assemble_audio_chunks(session_folder_path: str, user_id: str, wait_for_final_chunk: bool = True):
    """
    Находит, сортирует и объединяет аудио-чанки в один файл для указанного пользователя.
    wait_for_final_chunk: если True, ждет 10 секунд перед сборкой.
    """
    try:
        if wait_for_final_chunk:
            log("ASSEMBLER", f"Ожидание 10 секунд для получения финальных чанков для пользователя {user_id}...")
            await asyncio.sleep(10)

        safe_user_id = "".join(c for c in user_id if c.isalnum() or c in ('-', '_'))[:8]
        search_pattern = os.path.join(session_folder_path, f"{safe_user_id}_chunk_*.webm")
        chunk_files = glob.glob(search_pattern)

        if not chunk_files:
            log("ASSEMBLER", f"Не найдены аудио-чанки для пользователя {user_id} в папке {os.path.basename(session_folder_path)}", level=logging.WARNING)
            return

        chunk_files.sort(key=lambda f: int(f.split('_chunk_')[-1].split('.')[0]))
        
        final_filename = f"{os.path.basename(session_folder_path)}_{safe_user_id}.webm"
        final_filepath = os.path.join(session_folder_path, final_filename)

        log("ASSEMBLER", f"Начало сборки {len(chunk_files)} чанков в файл {final_filename} для пользователя {user_id}")

        with open(final_filepath, 'wb') as final_file:
            for chunk_path in chunk_files:
                with open(chunk_path, 'rb') as chunk_file:
                    final_file.write(chunk_file.read())
        
        log("ASSEMBLER", f"Файл {final_filename} успешно собран. Удаление временных чанков...")

        for chunk_path in chunk_files:
            try:
                os.remove(chunk_path)
            except OSError as e:
                log("ERROR", f"Не удалось удалить временный файл {chunk_path}: {e}", level=logging.ERROR)
        
        message_to_admin = f"🎤 <b>Собран полный аудиофайл звонка</b>\n\n<b>Файл:</b> <code>{os.path.basename(session_folder_path)}/{final_filename}</code>"
        await notifier.send_admin_notification(message_to_admin, 'notify_on_audio_record', file_path=final_filepath)

        await transcribe_audio_file(final_filepath)

    except Exception as e:
        log("CRITICAL", f"Критическая ошибка при сборке аудио для пользователя {user_id}: {e}", level=logging.CRITICAL)


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
        
        try:
            call_start_time = datetime.now(timezone.utc)
            folder_name = f"{call_start_time.strftime('%Y%m%d_%H%M%S')}_{room.room_id[:8]}"
            record_path = os.path.join(RECORDS_DIR, folder_name)
            os.makedirs(record_path, exist_ok=True)
            room.current_call_record_path = record_path
            log("ASSEMBLER", f"Создана директория для записи звонка: {record_path}")
        except OSError as e:
            log("ERROR", f"Не удалось создать директорию для записи звонка: {e}", level=logging.ERROR)
            room.current_call_record_path = None

        initiator = room.users.get(caller_id)
        receiver = room.users.get(acceptor_id)
        
        p1_ip = initiator.get('ip_address') if initiator else None
        p2_ip = receiver.get('ip_address') if receiver else None
        initiator_ip = p1_ip
        
        # Получаем ID инициатора
        initiator_user_id = initiator.get('id') if initiator else None

        asyncio.create_task(database.log_call_start(
            room.room_id,
            room.pending_call_type,
            p1_ip,
            p2_ip,
            initiator_ip,
            initiator_user_id # Передаем ID
        ))
        
        message_to_admin = (
            f"📞 <b>Звонок начался</b>\n\n"
            f"<b>Room ID:</b> <code>{room.room_id}</code>\n"
            f"<b>Тип:</b> {room.pending_call_type}\n"
            f"<b>Время:</b> {call_start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )
        asyncio.create_task(
            notifier.send_admin_notification(message_to_admin, 'notify_on_call_start')
        )
        room.pending_call_type = None
        
    await room.send_personal_message({"type": "call_accepted", "data": {"from": acceptor_id}}, caller_id)

# ... (остальные функции без изменений) ...
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
        
        if room.current_call_record_path:
            log("ASSEMBLER", f"Штатное завершение звонка. Запускаю сборку аудио для комнаты {room.room_id}")
            room.set_assembly_triggered(initiator_id)
            room.set_assembly_triggered(target_id)
            asyncio.create_task(assemble_audio_chunks(room.current_call_record_path, initiator_id))
            asyncio.create_task(assemble_audio_chunks(room.current_call_record_path, target_id))
    
    await room.send_personal_message({"type": "call_ended"}, target_id)
    await room.set_user_status(initiator_id, "available")
    await room.set_user_status(target_id, "available")

async def handle_abrupt_disconnection(room: RoomManager, disconnected_user_id: str):
    """Обрабатывает аварийное завершение звонка из-за дисконнекта."""
    log("ASSEMBLER", f"Пользователь {disconnected_user_id} аварийно отключился во время звонка.", level=logging.WARNING)
    
    if room.current_call_record_path and not room.assembly_triggered.get(disconnected_user_id, False):
        log("ASSEMBLER", f"Запускаю аварийную сборку аудио для {disconnected_user_id}.")
        room.set_assembly_triggered(disconnected_user_id)
        asyncio.create_task(assemble_audio_chunks(room.current_call_record_path, disconnected_user_id, wait_for_final_chunk=False))

async def process_webrtc_signal(room: RoomManager, sender_id: str, message: dict):
    target_id = message.get("data", {}).get("target_id")
    if not target_id:
        log("WEBSOCKET_EVENT", f"Получено WebRTC сообщение типа '{message.get('type')}' без target_id от {sender_id}. Игнорируется.", level=logging.WARNING)
        return
    
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