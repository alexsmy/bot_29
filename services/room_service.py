# `services/room_service.py`

import os
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, constants
from telegram.ext import ContextTypes

import database
import notifier
from main import manager
from bot_utils import format_hours

async def create_room_and_get_id(user_id: int, lifetime_hours: int) -> str:
    room_id = str(uuid.uuid4())
    
    await manager.get_or_create_room(room_id, lifetime_hours=lifetime_hours)

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(hours=lifetime_hours)
    asyncio.create_task(database.log_call_session(room_id, user_id, created_at, expires_at))

    is_admin_room = str(user_id) == os.environ.get("ADMIN_USER_ID")
    if not is_admin_room:
        message_to_admin = (
            f"🚪 <b>Создана новая комната (Mini App)</b>\n\n"
            f"<b>User ID:</b> <code>{user_id}</code>\n"
            f"<b>Room ID:</b> <code>{room_id}</code>\n"
            f"<b>Время:</b> {created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )
        asyncio.create_task(
            notifier.send_admin_notification(message_to_admin, 'notify_on_room_creation')
        )
        
    return room_id

async def create_and_send_room_link(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user_id: int, lifetime_hours: int):
    room_id = await create_room_and_get_id(user_id, lifetime_hours)
    
    web_app_url = os.environ.get("WEB_APP_URL", "http://localhost:8000")
    if not web_app_url.endswith('/'):
        web_app_url += '/'
    full_link = f"{web_app_url}call/{room_id}"

    link_text = "🔗 <b>Ссылка для соединения</b> 📞"
    lifetime_text = format_hours(lifetime_hours)
    message_text = (
        f"Ваша приватная ссылка для звонка готова:\n\n"
        f"<a href=\"{full_link}\">{link_text}</a>\n\n"
        f"Ссылка будет действительна в течение {lifetime_text}.\n\n"
        "Вы можете просто **переслать это сообщение** собеседнику, либо использовать кнопку 'Поделиться' для отправки чистого приглашения."
    )

    keyboard = [
        [InlineKeyboardButton("↪️ Поделиться", switch_inline_query=room_id)],
        [InlineKeyboardButton("🚪 Открыть комнату", url=full_link)]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await context.bot.send_message(
        chat_id=chat_id,
        text=message_text,
        parse_mode=constants.ParseMode.HTML,
        disable_web_page_preview=True,
        reply_markup=reply_markup
    )