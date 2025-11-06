import os
import uuid
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

import database
from logger_config import logger
from config import (
    ADMIN_ROOM_LIFETIME_1_HOUR,
    ADMIN_ROOM_LIFETIME_1_DAY,
    ADMIN_ROOM_LIFETIME_1_MONTH,
    ADMIN_ROOM_LIFETIME_1_YEAR
)
from bot_utils import log_user_and_action
from services import room_service

async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает команду /admin."""
    await log_user_and_action(update, "/admin")
    user = update.effective_user
    admin_id_str = os.environ.get("ADMIN_USER_ID")

    if not admin_id_str or int(user.id) != int(admin_id_str):
        logger.warning(f"Несанкционированная попытка доступа к /admin от пользователя ID {user.id}.")
        await update.message.reply_text("Эта команда вам недоступна.")
        return

    logger.info(f"Администратор (ID: {user.id}) запросил доступ к панели.")
    
    keyboard = [
        [InlineKeyboardButton("🔗 Ссылка на админ-панель", callback_data="admin_panel_link")],
        [InlineKeyboardButton("📞 Создать комнату для звонков", callback_data="admin_create_room_menu")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text("Панель администратора. Выберите действие:", reply_markup=reply_markup)

async def admin_panel_link_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает нажатие на кнопку 'Ссылка на админ-панель'."""
    query = update.callback_query
    await query.answer()
    await log_user_and_action(update, "admin_panel_link")

    token = str(uuid.uuid4())
    await database.add_admin_token(token)

    web_app_url = os.environ.get("WEB_APP_URL", "http://localhost:8000")
    if not web_app_url.endswith('/'):
        web_app_url += '/'
    admin_link = f"{web_app_url}admin/{token}"

    message_text = (
        f"Ваша ссылка для доступа к панели администратора:\n\n"
        f"<a href=\"{admin_link}\">👨‍💻 Открыть админ-панель</a>\n\n"
        "Ссылка действительна в течение 1 часа."
    )

    await query.edit_message_text(
        text=message_text,
        parse_mode='HTML',
        disable_web_page_preview=True
    )

async def admin_create_room_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показывает меню выбора времени жизни для админ-комнаты."""
    query = update.callback_query
    await query.answer()
    await log_user_and_action(update, "admin_create_room_menu")

    keyboard = [
        [
            InlineKeyboardButton("1 час", callback_data=f"admin_create_room_{ADMIN_ROOM_LIFETIME_1_HOUR}"),
            InlineKeyboardButton("1 сутки", callback_data=f"admin_create_room_{ADMIN_ROOM_LIFETIME_1_DAY}")
        ],
        [
            InlineKeyboardButton("1 месяц", callback_data=f"admin_create_room_{ADMIN_ROOM_LIFETIME_1_MONTH}"),
            InlineKeyboardButton("1 год", callback_data=f"admin_create_room_{ADMIN_ROOM_LIFETIME_1_YEAR}")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text("Выберите время действия комнаты:", reply_markup=reply_markup)

async def admin_create_room_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Создает админ-комнату с выбранным временем жизни."""
    query = update.callback_query
    await query.answer("Создаю долгоживущую ссылку...")
    
    lifetime_hours = int(query.data.split('_')[-1])
    await log_user_and_action(update, f"admin_create_room_{lifetime_hours}h")
    
    user = update.effective_user
    logger.info(f"Администратор {user.first_name} (ID: {user.id}) создает ссылку на {lifetime_hours} часов.")
    
    await query.message.delete()
    await room_service.create_and_send_room_link(context, query.message.chat_id, user.id, lifetime_hours)