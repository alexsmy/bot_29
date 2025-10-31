# START OF FILE bot.py

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, constants, BotCommand, InputTextMessageContent, InlineQueryResultArticle
from telegram.ext import Application, CommandHandler, ContextTypes, CallbackQueryHandler, MessageHandler, filters, InlineQueryHandler

import database
from main import manager  # Убедимся, что импортируем менеджер из main
from logger_config import logger
from config import (
    PRIVATE_ROOM_LIFETIME_HOURS,
    ADMIN_ROOM_LIFETIME_1_HOUR,
    ADMIN_ROOM_LIFETIME_1_DAY,
    ADMIN_ROOM_LIFETIME_1_MONTH,
    ADMIN_ROOM_LIFETIME_1_YEAR
)

# --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Создаем экземпляр приложения бота здесь, но не запускаем его ---
bot_token = os.environ.get("BOT_TOKEN")
if not bot_token:
    logger.critical("Токен бота (BOT_TOKEN) не найден. Приложение не может запуститься.")
    sys.exit(1)

# Эта функция будет вызвана из main.py при старте сервера
async def post_init(application: Application) -> None:
    public_commands = [
        BotCommand("start", "🚀 Создать новую ссылку для звонка"),
        BotCommand("instructions", "📖 Как пользоваться ботом"),
        BotCommand("faq", "❓ Ответы на частые вопросы"),
    ]
    await application.bot.set_my_commands(public_commands)
    logger.info("Меню публичных команд успешно установлено.")

# Создаем, но не запускаем приложение. Оно будет запущено в main.py
builder = Application.builder().token(bot_token).post_init(post_init)
bot_app_instance = builder.build()
# --- КОНЕЦ КЛЮЧЕВОГО ИЗМЕНЕНИЯ ---


def format_hours(hours: int) -> str:
    """Правильно форматирует часы (1 час, 2 часа, 5 часов)."""
    if hours % 10 == 1 and hours % 100 != 11:
        return f"{hours} час"
    elif 2 <= hours % 10 <= 4 and (hours % 100 < 10 or hours % 100 >= 20):
        return f"{hours} часа"
    else:
        return f"{hours} часов"

def read_template_content(filename: str, replacements: dict = None) -> str:
    template_path = os.path.join("templates", filename)
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if replacements:
                for key, value in replacements.items():
                    content = content.replace(f"{{{key}}}", str(value))
            return content
    except FileNotFoundError:
        logger.critical(f"Файл шаблона не найден: {template_path}")
        return "Ошибка: Не удалось загрузить содержимое."

async def log_user_and_action(update: Update, action: str):
    user = update.effective_user
    await database.log_user(user.id, user.first_name, user.last_name, user.username)
    await database.log_bot_action(user.id, action)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
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
    await log_user_and_action(update, "/instructions")
    user_name = update.effective_user.first_name
    logger.info(f"Пользователь {user_name} (ID: {update.effective_user.id}) запросил инструкцию.")

    instructions_text = read_template_content("instructions_bot.html")
    
    await update.message.reply_text(instructions_text, parse_mode=constants.ParseMode.HTML)

async def faq(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await log_user_and_action(update, "/faq")
    user_name = update.effective_user.first_name
    logger.info(f"Пользователь {user_name} (ID: {update.effective_user.id}) запросил FAQ.")

    faq_text = read_template_content("faq_bot.html", {"LIFETIME_HOURS": PRIVATE_ROOM_LIFETIME_HOURS})

    await update.message.reply_text(faq_text, parse_mode=constants.ParseMode.HTML)

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await log_user_and_action(update, "Sent unhandled message")
    user_name = update.effective_user.first_name
    logger.info(f"Пользователь {user_name} (ID: {update.effective_user.id}) отправил непредусмотренное сообщение.")

    reminder_text = (
        "Я умею только генерировать ссылки для звонков. Пожалуйста, используйте для этого команду /start.\n\n"
        "Если у вас есть вопросы, воспользуйтесь меню:\n"
        "• /instructions - чтобы посмотреть инструкции.\n"
        "• /faq - чтобы найти ответы на частые вопросы."
    )
    await update.message.reply_text(reminder_text)

async def _create_and_send_room_link(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user_id: int, lifetime_hours: int):
    room_id = str(uuid.uuid4())
    web_app_url = os.environ.get("WEB_APP_URL", "http://localhost:8000")
    if not web_app_url.endswith('/'):
        web_app_url += '/'
    full_link = f"{web_app_url}call/{room_id}"

    await manager.get_or_create_room(room_id, lifetime_hours=lifetime_hours)

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(hours=lifetime_hours)
    await database.log_call_session(room_id, user_id, created_at, expires_at)

    link_text = "🔗 <b>Ссылка для соединения</b> 📞"
    lifetime_text = format_hours(lifetime_hours)
    message_text = (
        f"Ваша приватная ссылка для звонка готова:\n\n"
        f"<a href=\"{full_link}\">{link_text}</a>\n\n"
        f"Ссылка будет действительна в течение {lifetime_text}.\n\n"
        "Вы можете просто **переслать это сообщение** собеседнику, либо использовать кнопку 'Поделиться' для отправки чистого приглашения (без пометки 'Переслано')."
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

async def handle_create_link_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await log_user_and_action(update, "create_private_link")
    query = update.callback_query
    await query.answer("Создаю ссылку...")

    user = update.effective_user
    logger.info(f"Пользователь {user.first_name} (ID: {user.id}) создает приватную ссылку.")
    
    await _create_and_send_room_link(context, query.message.chat_id, user.id, PRIVATE_ROOM_LIFETIME_HOURS)

async def handle_inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
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

async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
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
    query = update.callback_query
    await query.answer()
    await log_user_and_action(update, "admin_panel_link")

    token = str(uuid.uuid4())
    await database.add_admin_token(token)

    web_app_url = os.environ.get("WEB_APP_URL", "http://localhost:8000")
    if not web_app_url.endswith('/'):
        web_app_url += '/'
    admin_link = f"{web_app_url}admin/{token}"

    await query.edit_message_text(
        f"Ваша ссылка для доступа к панели администратора:\n\n{admin_link}\n\n"
        "Ссылка действительна в течение 1 часа."
    )

async def admin_create_room_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
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
    query = update.callback_query
    await query.answer("Создаю долгоживущую ссылку...")
    
    lifetime_hours = int(query.data.split('_')[-1])
    await log_user_and_action(update, f"admin_create_room_{lifetime_hours}h")
    
    user = update.effective_user
    logger.info(f"Администратор {user.first_name} (ID: {user.id}) создает ссылку на {lifetime_hours} часов.")
    
    await query.message.delete()
    await _create_and_send_room_link(context, query.message.chat_id, user.id, lifetime_hours)

# Добавляем все обработчики в приложение бота
bot_app_instance.add_handler(CommandHandler("start", start))
bot_app_instance.add_handler(CommandHandler("instructions", instructions))
bot_app_instance.add_handler(CommandHandler("faq", faq))
bot_app_instance.add_handler(CommandHandler("admin", admin_command))
bot_app_instance.add_handler(CallbackQueryHandler(handle_create_link_callback, pattern="^create_private_link$"))
bot_app_instance.add_handler(CallbackQueryHandler(admin_panel_link_callback, pattern="^admin_panel_link$"))
bot_app_instance.add_handler(CallbackQueryHandler(admin_create_room_menu_callback, pattern="^admin_create_room_menu$"))
bot_app_instance.add_handler(CallbackQueryHandler(admin_create_room_callback, pattern=r"^admin_create_room_\d+$"))
bot_app_instance.add_handler(InlineQueryHandler(handle_inline_query))
bot_app_instance.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND | filters.ATTACHMENT, echo))

# --- УДАЛЕНА ВСЯ ЛОГИКА ЗАПУСКА (run_fastapi, main, if __name__ == "__main__") ---
# --- Теперь этот файл только определяет и настраивает bot_app_instance ---

# END OF FILE bot.py