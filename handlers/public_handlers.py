# `handlers/public_handlers.py`

from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from telegram.ext import ContextTypes

from logger_config import logger
from config import WEB_APP_URL
from bot_utils import log_user_and_action

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await log_user_and_action(update, "/start")
    user = update.effective_user
    logger.info(f"Пользователь {user.first_name} (ID: {user.id}) запустил команду /start.")

    web_app_info = WebAppInfo(url=f"{WEB_APP_URL}mini-app")
    
    keyboard = ReplyKeyboardMarkup(
        [[KeyboardButton("🚀 Открыть приложение для звонков", web_app=web_app_info)]],
        resize_keyboard=True
    )
    
    await update.message.reply_text(
        "👋 Добро пожаловать!\n\nНажмите кнопку ниже, чтобы запустить приложение для создания приватных звонков.",
        reply_markup=keyboard
    )

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await log_user_and_action(update, "Sent unhandled text")
    await update.message.reply_text(
        "Для работы с сервисом, пожалуйста, используйте кнопку '🚀 Открыть приложение для звонков' ниже."
    )