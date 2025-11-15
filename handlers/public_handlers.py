from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, constants
from telegram.ext import ContextTypes, filters

import database
from logger_config import logger
from config import PRIVATE_ROOM_LIFETIME_HOURS, MAX_ACTIVE_ROOMS_PER_USER, MAX_ROOM_CREATIONS_PER_DAY
from bot_utils import log_user_and_action, read_template_content, format_hours, check_and_handle_spam
from services import room_service

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает команду /start."""
    # --- ИЗМЕНЕНИЕ: Проверяем пользователя перед обработкой команды ---
    if await check_and_handle_spam(update, context, "Sent /start command while potentially blocked"):
        return
    # --- КОНЕЦ ИЗМЕНЕНИЯ ---
    
    await log_user_and_action(update, "/start")
    user_name = update.effective_user.first_name
    logger.info(f"Пользователь {user_name} (ID: {update.effective_user.id}) запустил команду /start.")

    keyboard = [
        [InlineKeyboardButton("🔗 Создать приватную ссылку", callback_data="create_private_link")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    welcome_text = (
        f"👋 Добро пожаловать, {user_name}!\n\n"
        "Этот бот создает приватные, зашифрованные аудио- и видеозвонки прямо в браузере.\n\n"
        "Просто нажмите кнопку ниже, чтобы сгенерировать уникальную ссылку для звонка. "
        "Поделитесь этой ссылкой с вашим собеседником, и вы сможете начать разговор.\n\n"
        f"Ссылка действительна в течение {format_hours(PRIVATE_ROOM_LIFETIME_HOURS)}."
    )

    await update.message.reply_text(welcome_text, reply_markup=reply_markup)

async def instructions(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает команду /instructions."""
    if await check_and_handle_spam(update, context, "Sent /instructions command"):
        return
        
    await log_user_and_action(update, "/instructions")
    user_name = update.effective_user.first_name
    logger.info(f"Пользователь {user_name} (ID: {update.effective_user.id}) запросил инструкцию.")

    instructions_text = read_template_content("instructions_bot.html")
    
    await update.message.reply_text(instructions_text, parse_mode=constants.ParseMode.HTML)

async def faq(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает команду /faq."""
    if await check_and_handle_spam(update, context, "Sent /faq command"):
        return
        
    await log_user_and_action(update, "/faq")
    user_name = update.effective_user.first_name
    logger.info(f"Пользователь {user_name} (ID: {update.effective_user.id}) запросил FAQ.")

    faq_text = read_template_content("faq_bot.html", {"LIFETIME_HOURS": PRIVATE_ROOM_LIFETIME_HOURS})

    await update.message.reply_text(faq_text, parse_mode=constants.ParseMode.HTML)

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает все текстовые сообщения, которые не являются командами."""
    # --- ИЗМЕНЕНИЕ: Проверяем на спам ПЕРЕД отправкой ответа ---
    if await check_and_handle_spam(update, context, "Sent unhandled text message"):
        return # Если пользователь заблокирован, просто выходим
    # --- КОНЕЦ ИЗМЕНЕНИЯ ---

    user_name = update.effective_user.first_name
    logger.info(f"Пользователь {user_name} (ID: {update.effective_user.id}) отправил непредусмотренное текстовое сообщение.")

    reminder_text = (
        "Я умею генерировать ссылки для звонков, пожалуйста, используйте для этого команду /start.\n\n"
        "Если у вас есть вопросы, воспользуйтесь меню:\n"
        "• /instructions - чтобы посмотреть инструкции.\n"
        "• /faq - чтобы найти ответы на частые вопросы."
    )
    await update.message.reply_text(reminder_text)

async def handle_attachment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обрабатывает любые вложения (файлы, фото, аудио и т.д.), отправленные пользователем.
    """
    # --- ИЗМЕНЕНИЕ: Проверяем на спам ПЕРЕД отправкой ответа ---
    if await check_and_handle_spam(update, context, "Sent an attachment"):
        return # Если пользователь заблокирован, просто выходим
    # --- КОНЕЦ ИЗМЕНЕНИЯ ---
    
    user = update.effective_user
    logger.warning(f"Пользователь {user.first_name} (ID: {user.id}) отправил вложение. Сообщение проигнорировано.")

    reply_text = (
        "Извините, я не обрабатываю файлы, изображения и другие вложения.\n\n"
        "Если Вы хотите создать ссылку для звонков, пожалуйста, используйте команду /start."
    )
    await update.message.reply_text(reply_text)

async def handle_create_link_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает нажатие на кнопку 'Создать приватную ссылку'."""
    query = update.callback_query
    user = update.effective_user

    # --- ИЗМЕНЕНИЕ: Проверяем пользователя перед обработкой ---
    if await check_and_handle_spam(update, context, "Used create_private_link button"):
        await query.answer("Действие временно недоступно.", show_alert=True)
        return
    # --- КОНЕЦ ИЗМЕНЕНИЯ ---

    await log_user_and_action(update, "create_private_link")
    
    # --- НОВАЯ ЛОГИКА: Проверка лимитов на создание комнат ---
    # 1. Проверка на количество одновременно активных комнат
    active_rooms_count = await database.count_active_rooms_by_user(user.id)
    if active_rooms_count >= MAX_ACTIVE_ROOMS_PER_USER:
        logger.warning(f"Пользователь {user.id} попытался создать комнату сверх лимита активных ({active_rooms_count}/{MAX_ACTIVE_ROOMS_PER_USER}).")
        await query.answer(f"Достигнут лимит активных комнат ({MAX_ACTIVE_ROOMS_PER_USER}).", show_alert=True)
        await query.message.reply_text(
            f"У вас уже есть {active_rooms_count} активных комнат. "
            "Пожалуйста, используйте их или дождитесь, пока их срок действия истечет, прежде чем создавать новые."
        )
        return

    # 2. Проверка на суточный лимит созданных комнат
    daily_creations_count = await database.count_recent_room_creations_by_user(user.id)
    if daily_creations_count >= MAX_ROOM_CREATIONS_PER_DAY:
        logger.warning(f"Пользователь {user.id} превысил суточный лимит создания комнат ({daily_creations_count}/{MAX_ROOM_CREATIONS_PER_DAY}).")
        
        # Регистрируем это как спам-действие. Если это действие приведет к блокировке, функция вернет True.
        is_now_blocked = await check_and_handle_spam(update, context, "Exceeded daily room creation limit")
        
        await query.answer("Вы превысили дневной лимит на создание комнат.", show_alert=True)
        if is_now_blocked:
            await query.message.reply_text("За превышение суточного лимита на создание комнат ваш аккаунт был временно заблокирован.")
        return
    # --- КОНЕЦ НОВОЙ ЛОГИКИ ---

    await query.answer("Создаю ссылку...")
    logger.info(f"Пользователь {user.first_name} (ID: {user.id}) создает приватную ссылку.")
    
    await room_service.create_and_send_room_link(context, query.message.chat_id, user.id, PRIVATE_ROOM_LIFETIME_HOURS)