import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, constants
from telegram.ext import ContextTypes, filters

import database
from configurable_logger import log
from config import PRIVATE_ROOM_LIFETIME_HOURS, MAX_ACTIVE_ROOMS_PER_USER, MAX_ROOM_CREATIONS_PER_DAY, WEB_APP_URL
from bot_utils import log_user_and_action, read_template_content, format_hours, check_and_handle_spam, format_remaining_time
from services import room_service

def get_room_count_text(n: int) -> str:
    if n == 1:
        return "комната"
    elif 2 <= n <= 4:
        return "комнаты"
    return "комнат"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await check_and_handle_spam(update, context, "Sent /start command while potentially blocked"):
        return
    
    await log_user_and_action(update, "/start")
    user = update.effective_user
    user_name = user.first_name
    log("BOT_SETUP", f"Пользователь {user_name} (ID: {user.id}) запустил команду /start.")

    active_rooms = await database.get_active_rooms_by_user(user.id)
    n_rooms = len(active_rooms)
    
    keyboard = []
    
    if n_rooms == 0:
        message_text = (
            f"👋 Добро пожаловать, {user_name}!\n\n"
            "Этот бот создает ссылки на приватные, зашифрованные аудио- и видеозвонки прямо в браузере.\n\n"
            "Просто нажмите кнопку ниже, чтобы сгенерировать уникальную комнату для звонка. "
            "Поделитесь этой ссылкой с вашим собеседником, и вы сможете начать разговор.\n\n"
            f"Ссылка действительна в течение {format_hours(PRIVATE_ROOM_LIFETIME_HOURS)}."
        )
        keyboard.append([InlineKeyboardButton("➕ Создать новую", callback_data="create_private_link")])
    else:
        message_text = f"У вас уже есть {n_rooms} активных {get_room_count_text(n_rooms)}."
        
        app_url = os.environ.get("RENDER_EXTERNAL_URL") or WEB_APP_URL
        if not app_url.endswith('/'):
            app_url += '/'
        
        for room in active_rooms:
            remaining_time_str = format_remaining_time(room['expires_at'])
            room_url = f"{app_url}call/{room['room_id']}"
            button_text = f"🚪Открыть. ⏳{remaining_time_str}"
            keyboard.append([InlineKeyboardButton(button_text, url=room_url)])
            
        if n_rooms < MAX_ACTIVE_ROOMS_PER_USER:
            keyboard.append([InlineKeyboardButton("➕ Создать новую", callback_data="create_private_link")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(message_text, reply_markup=reply_markup)


async def instructions(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await check_and_handle_spam(update, context, "Sent /instructions command"):
        return
        
    await log_user_and_action(update, "/instructions")
    user_name = update.effective_user.first_name
    log("BOT_SETUP", f"Пользователь {user_name} (ID: {update.effective_user.id}) запросил инструкцию.")

    instructions_text = read_template_content("instructions_bot.html")
    
    await update.message.reply_text(instructions_text, parse_mode=constants.ParseMode.HTML)

async def faq(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await check_and_handle_spam(update, context, "Sent /faq command"):
        return
        
    await log_user_and_action(update, "/faq")
    user_name = update.effective_user.first_name
    log("BOT_SETUP", f"Пользователь {user_name} (ID: {update.effective_user.id}) запросил FAQ.")

    faq_text = read_template_content("faq_bot.html", {"LIFETIME_HOURS": PRIVATE_ROOM_LIFETIME_HOURS})

    await update.message.reply_text(faq_text, parse_mode=constants.ParseMode.HTML)

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await check_and_handle_spam(update, context, "Sent unhandled text message"):
        return

    user_name = update.effective_user.first_name
    log("UNHANDLED_MESSAGE", f"Пользователь {user_name} (ID: {update.effective_user.id}) отправил непредусмотренное текстовое сообщение.")

    reminder_text = (
        "Я умею генерировать ссылки для звонков, пожалуйста, используйте для этого команду /start.\n\n"
        "Если у вас есть вопросы, воспользуйтесь меню:\n"
        "• /instructions - чтобы посмотреть инструкции.\n"
        "• /faq - чтобы найти ответы на частые вопросы."
    )
    await update.message.reply_text(reminder_text)

async def handle_attachment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await check_and_handle_spam(update, context, "Sent an attachment"):
        return
    
    user = update.effective_user
    log("UNHANDLED_MESSAGE", f"Пользователь {user.first_name} (ID: {user.id}) отправил вложение. Сообщение проигнорировано.", level=logging.WARNING)

    reply_text = (
        "Извините, я не обрабатываю файлы, изображения и другие вложения.\n\n"
        "Если Вы хотите создать ссылку для звонков, пожалуйста, используйте команду /start."
    )
    await update.message.reply_text(reply_text)

async def handle_create_link_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user

    if await check_and_handle_spam(update, context, "Used create_private_link button"):
        await query.answer("Действие временно недоступно.", show_alert=True)
        return

    await log_user_and_action(update, "create_private_link")
    
    active_rooms_count = await database.count_active_rooms_by_user(user.id)
    if active_rooms_count >= MAX_ACTIVE_ROOMS_PER_USER:
        log("SPAM_DETECT", f"Пользователь {user.id} попытался создать комнату сверх лимита активных ({active_rooms_count}/{MAX_ACTIVE_ROOMS_PER_USER}).", level=logging.WARNING)
        await query.answer(f"Достигнут лимит активных комнат ({MAX_ACTIVE_ROOMS_PER_USER}).", show_alert=True)
        await query.message.reply_text(
            f"У вас уже есть {active_rooms_count} активных комнат. "
            "Пожалуйста, используйте их или дождитесь, пока их срок действия истечет, прежде чем создавать новые."
        )
        return

    daily_creations_count = await database.count_recent_room_creations_by_user(user.id)
    if daily_creations_count >= MAX_ROOM_CREATIONS_PER_DAY:
        log("SPAM_DETECT", f"Пользователь {user.id} превысил суточный лимит создания комнат ({daily_creations_count}/{MAX_ROOM_CREATIONS_PER_DAY}).", level=logging.WARNING)
        
        is_now_blocked = await check_and_handle_spam(update, context, "Exceeded daily room creation limit")
        
        await query.answer("Вы превысили дневной лимит на создание комнат.", show_alert=True)
        if is_now_blocked:
            await query.message.reply_text("За превышение суточного лимита на создание комнат ваш аккаунт был временно заблокирован.")
        return

    await query.answer("Создаю ссылку...")
    log("ROOM_LIFECYCLE", f"Пользователь {user.first_name} (ID: {user.id}) создает приватную ссылку.")
    
    await room_service.create_and_send_room_link(context, query.message.chat_id, user.id, PRIVATE_ROOM_LIFETIME_HOURS)