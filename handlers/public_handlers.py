from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo, constants
from telegram.ext import ContextTypes, filters

from logger_config import logger
from config import PRIVATE_ROOM_LIFETIME_HOURS, WEB_APP_URL
from bot_utils import log_user_and_action, read_template_content, format_hours
from services import room_service

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

async def app(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await log_user_and_action(update, "/app")
    logger.info(f"Пользователь {update.effective_user.first_name} (ID: {update.effective_user.id}) запустил Mini App.")
    
    keyboard = ReplyKeyboardMarkup.from_button(
        KeyboardButton(
            text="▶️ Открыть приложение",
            web_app=WebAppInfo(url=f"{WEB_APP_URL}app")
        ),
        resize_keyboard=True
    )
    await update.message.reply_text(
        "Нажмите кнопку ниже, чтобы запустить приложение для звонков.",
        reply_markup=keyboard
    )

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

async def handle_create_link_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await log_user_and_action(update, "create_private_link")
    query = update.callback_query
    await query.answer("Создаю ссылку...")

    user = update.effective_user
    logger.info(f"Пользователь {user.first_name} (ID: {user.id}) создает приватную ссылку.")
    
    await room_service.create_and_send_room_link(context, query.message.chat_id, user.id, PRIVATE_ROOM_LIFETIME_HOURS)