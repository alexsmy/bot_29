# handlers/public_handlers.py
import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, constants
from telegram.ext import ContextTypes, filters, ConversationHandler

import database
import notifier
from configurable_logger import log
from config import PRIVATE_ROOM_LIFETIME_HOURS, MAX_ACTIVE_ROOMS_PER_USER, MAX_ROOM_CREATIONS_PER_DAY, WEB_APP_URL, ADMIN_USER_ID
from bot_utils import log_user_and_action, read_template_content, format_hours, check_and_handle_spam, format_remaining_time
from services import room_service

WAITING_FEEDBACK = 0

def get_room_count_text(n: int) -> str:
    if n == 1:
        return "комната"
    elif 2 <= n <= 4:
        return "комнаты"
    return "комнат"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    user_name = user.first_name

    # --- ИСПРАВЛЕНИЕ: Начало ---
    # 1. Сначала проверяем статус пользователя, чтобы понять, новый он или нет,
    #    а также не заблокирован ли он.
    status = await database.get_user_status(user.id)

    if status == 'blocked':
        log("SPAM_DETECT", f"Получено /start от заблокированного пользователя {user.id}. Игнорируем.", level=logging.WARNING)
        return

    # 2. Определяем, новый ли пользователь, ДО того, как он будет записан в БД.
    is_new_user = status is None

    # 3. Теперь, когда мы определили статус, можно безопасно логировать.
    #    Если пользователя не было, он будет создан здесь.
    await log_user_and_action(update, "/start")
    log("BOT_SETUP", f"Пользователь {user_name} (ID: {user.id}) запустил команду /start. Новый пользователь: {is_new_user}.")
    # --- ИСПРАВЛЕНИЕ: Конец ---

    if is_new_user:
        # Теперь этот блок будет корректно выполняться для новых пользователей.
        await notifier.send_new_user_notification(user.id, user.first_name, user.username)
        
        welcome_caption = (
            f"👋 <b>Добро пожаловать, {user_name}!</b>\n\n"
            "Этот бот создает приватные, зашифрованные аудио- и видеозвонки прямо в браузере.\n\n"
            "Нажмите кнопку ниже, чтобы сгенерировать вашу первую ссылку."
        )
        keyboard = [[InlineKeyboardButton("➕ Создать новую ссылку", callback_data="create_private_link")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        try:
            with open('static/img/hero-mockup.jpg', 'rb') as photo:
                await update.message.reply_photo(
                    photo=photo,
                    caption=welcome_caption,
                    parse_mode=constants.ParseMode.HTML,
                    reply_markup=reply_markup
                )
        except FileNotFoundError:
            log("ERROR", "Файл hero-mockup.jpg не найден. Отправляю текстовое приветствие.", level=logging.ERROR)
            await update.message.reply_text(
                welcome_caption.replace("<b>", "").replace("</b>", ""), 
                reply_markup=reply_markup
            )
        return

    active_rooms = await database.get_active_rooms_by_user(user.id)
    n_rooms = len(active_rooms)
    
    keyboard = []
    
    if n_rooms == 0:
        message_text = (
            f"👋 С возвращением, {user_name}!\n\n"
            "Готовы создать новую ссылку для звонка?\n\n"
            f"Напоминаю, что ссылка действительна в течение {format_hours(PRIVATE_ROOM_LIFETIME_HOURS)}."
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
        
    # ИСПРАВЛЕНИЕ: Удален избыточный вызов log_user_and_action.
    # Основное логирование уже произошло внутри check_and_handle_spam.
    user_name = update.effective_user.first_name
    log("BOT_SETUP", f"Пользователь {user_name} (ID: {update.effective_user.id}) запросил инструкцию.")

    instructions_text = read_template_content("instructions_bot.html")
    
    await update.message.reply_text(instructions_text, parse_mode=constants.ParseMode.HTML)

async def faq(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await check_and_handle_spam(update, context, "Sent /faq command"):
        return
        
    # ИСПРАВЛЕНИЕ: Удален избыточный вызов log_user_and_action.
    # Основное логирование уже произошло внутри check_and_handle_spam.
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
        "• /faq - чтобы найти ответы на частые вопросы.\n"
        "• /feedback - чтобы отправить вопрос или пожелание."
    )
    await update.message.reply_text(reminder_text)

async def handle_attachment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if await check_and_handle_spam(update, context, "Sent an attachment"):
        return
    
    user = update.effective_user
    log("UNHANDLED_MESSAGE", f"Пользователь {user.first_name} (ID: {user.id}) отправил вложение. Сообщение проигнорировано.", level=logging.WARNING)

    reply_text = (
        "Извините, я не обрабатываю файлы, изображения и другие вложения.\n\n"
        "Если Вы хотите создать ссылку для звонков, пожалуйста, используйте команду /start.\n"
        "Если Вы хотите отправить вопрос или пожелание, воспользуйтесь командой /feedback."
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

async def feedback_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await log_user_and_action(update, "/feedback")
    await update.message.reply_text("✍️ Отправьте следующим сообщением Ваш вопрос или пожелание. Я перешлю его администратору.")
    return WAITING_FEEDBACK

async def feedback_receive(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    admin_id = os.environ.get("ADMIN_USER_ID")

    if not admin_id:
        log("ERROR", "ADMIN_USER_ID не установлен. Невозможно переслать сообщение.", level=logging.ERROR)
        await update.message.reply_text("К сожалению, сервис обратной связи временно недоступен.")
        return ConversationHandler.END

    await log_user_and_action(update, "Sent feedback message")
    
    try:
        await context.bot.forward_message(
            chat_id=admin_id,
            from_chat_id=user.id,
            message_id=update.message.message_id
        )
        await update.message.reply_text("✅ Спасибо! Ваше сообщение было отправлено.")
        log("NOTIFICATION", f"Получено и переслано сообщение обратной связи от пользователя {user.id}.")
    except Exception as e:
        log("ERROR", f"Не удалось переслать сообщение от {user.id} администратору: {e}", level=logging.ERROR)
        await update.message.reply_text("Произошла ошибка при отправке. Пожалуйста, попробуйте позже.")

    return ConversationHandler.END

async def feedback_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Отправка отзыва отменена. Вы можете продолжить использовать другие команды.")
    return ConversationHandler.END