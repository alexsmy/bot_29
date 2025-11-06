import os
import uuid
from telegram import Update, InputTextMessageContent, InlineQueryResultArticle, InlineKeyboardMarkup, InlineKeyboardButton, constants
from telegram.ext import ContextTypes

import database
from bot_utils import format_hours

async def handle_inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает inline-запросы для отправки приглашений."""
    query = update.inline_query.query
    if not query:
        return

    try:
        uuid.UUID(query)
    except ValueError:
        return

    room_id = query
    
    lifetime_hours = await database.get_room_lifetime_hours(room_id)
    lifetime_text = format_hours(lifetime_hours)

    web_app_url = os.environ.get("WEB_APP_URL", "http://localhost:8000")
    if not web_app_url.endswith('/'):
        web_app_url += '/'
    full_link = f"{web_app_url}call/{room_id}"
    
    icon_url = f"{web_app_url}static/share_icon.png"

    link_text = "🔗 <b>Ссылка для соединения</b> 📞"
    message_text_for_recipient = (
        f"Вас приглашают на приватный звонок:\n\n"
        f"<a href=\"{full_link}\">{link_text}</a>\n\n"
        f"Ссылка действительна в течение {lifetime_text}. "
        "Нажмите кнопку 'Открыть комнату', чтобы присоединиться."
    )
    
    keyboard_for_recipient = [
        [InlineKeyboardButton("🚪 Открыть комнату", url=full_link)]
    ]
    reply_markup_for_recipient = InlineKeyboardMarkup(keyboard_for_recipient)

    result = InlineQueryResultArticle(
        id=room_id,
        title="📲 Отправить приглашение на звонок",
        description=f"Комната: {room_id[:8]}...",
        input_message_content=InputTextMessageContent(
            message_text=message_text_for_recipient,
            parse_mode=constants.ParseMode.HTML,
            disable_web_page_preview=True
        ),
        reply_markup=reply_markup_for_recipient,
        thumbnail_url=icon_url,
        thumbnail_width=128,
        thumbnail_height=128
    )

    await update.inline_query.answer([result], cache_time=1)