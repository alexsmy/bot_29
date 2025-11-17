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

async def create_and_send_room_link(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user_id: int, lifetime_hours: int, room_type: str = 'private'):
    room_id = str(uuid.uuid4())
    web_app_url = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("WEB_APP_URL", "http://localhost:8000")
    if not web_app_url.endswith('/'):
        web_app_url += '/'
    full_link = f"{web_app_url}call/{room_id}"

    await manager.get_or_create_room(room_id, lifetime_hours=lifetime_hours, room_type=room_type)

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(hours=lifetime_hours)
    asyncio.create_task(database.log_call_session(room_id, user_id, created_at, expires_at, room_type))

    is_admin_room = str(user_id) == os.environ.get("ADMIN_USER_ID")
    if not is_admin_room:
        message_to_admin = (
            f"🚪 <b>Создана новая комната</b>\n\n"
            f"<b>User ID:</b> <code>{user_id}</code>\n"
            f"<b>Room ID:</b> <code>{room_id}</code>\n"
            f"<b>Время:</b> {created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )
        context.application.create_task(
            notifier.send_admin_notification(message_to_admin, 'notify_on_room_creation')
        )

    lifetime_text = format_hours(lifetime_hours)
    
    if room_type == 'special':
        link_in = f"{full_link}?roll_in"
        link_out = f"{full_link}?roll_out"
        message_text = (
            f"✅ <b>Создана специальная комната на {lifetime_text}.</b>\n\n"
            "Используйте эти две ссылки:\n\n"
            f"1️⃣ <b>Ссылка для приёма (roll_in):</b>\n"
            f"<a href=\"{link_in}\">🔗 Открыть страницу приёма</a>\n"
            "<em>Эту ссылку нужно отправить собеседнику. У него откроется страница ожидания, которая автоматически примет ваш звонок.</em>\n\n"
            f"2️⃣ <b>Ссылка для отправки (roll_out):</b>\n"
            f"<a href=\"{link_out}\">📞 Открыть страницу вызова</a>\n"
            "<em>Эту ссылку используйте вы, чтобы позвонить на страницу приёма.</em>"
        )
        keyboard = [
            [InlineKeyboardButton("📥 Открыть приём (для собеседника)", url=link_in)],
            [InlineKeyboardButton("📤 Открыть вызов (для вас)", url=link_out)]
        ]
    else:
        link_text = "🔗 <b>Ссылка для соединения</b> 📞"
        message_text = (
            f"Ваша приватная ссылка для звонка готова:\n\n"
            f"<a href=\"{full_link}\">{link_text}</a>\n\n"
            f"Ссылка будет действительна в течение {lifetime_text}.\n\n"
            "Вы можете просто <b>переслать это сообщение</b> собеседнику, либо использовать кнопку 'Поделиться' для отправки чистого приглашения (без пометки 'Переслано')."
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