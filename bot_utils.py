import os
import asyncio
import logging
from datetime import datetime, timezone
from telegram import Update
from telegram.ext import ContextTypes

import database
import notifier
from configurable_logger import log
from config import SPAM_STRIKE_LIMIT, SPAM_TIME_WINDOW_MINUTES

def format_hours(hours: int) -> str:
    if hours % 10 == 1 and hours % 100 != 11:
        return f"{hours} час"
    elif 2 <= hours % 10 <= 4 and (hours % 100 < 10 or hours % 100 >= 20):
        return f"{hours} часа"
    else:
        return f"{hours} часов"

def format_remaining_time(expires_at: datetime) -> str:
    now = datetime.now(timezone.utc)
    remaining = expires_at - now
    if remaining.total_seconds() <= 0:
        return "00:00"
    
    hours = int(remaining.total_seconds() // 3600)
    minutes = int((remaining.total_seconds() % 3600) // 60)
    
    return f"{hours:02d}:{minutes:02d}"

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
        log("CRITICAL", f"Файл шаблона не найден: {template_path}", level=logging.CRITICAL)
        return "Ошибка: Не удалось загрузить содержимое."

async def log_user_and_action(update: Update, action: str):
    user = update.effective_user
    await database.log_user(user.id, user.first_name, user.last_name, user.username)
    await database.log_bot_action(user.id, action)

async def check_and_handle_spam(update: Update, context: ContextTypes.DEFAULT_TYPE, spam_action_name: str) -> bool:
    user = update.effective_user
    if not user:
        return True

    status = await database.get_user_status(user.id)
    if status == 'blocked':
        log("SPAM_DETECT", f"Получено сообщение от заблокированного пользователя {user.id}. Игнорируем.", level=logging.WARNING)
        return True

    await log_user_and_action(update, spam_action_name)

    strike_count = await database.count_spam_strikes(user.id)

    if strike_count >= SPAM_STRIKE_LIMIT:
        await database.update_user_status(user.id, 'blocked')
        log("USER_BLOCK", f"Пользователь {user.first_name} (ID: {user.id}) заблокирован за спам. "
                        f"({strike_count} нарушений за {SPAM_TIME_WINDOW_MINUTES} минут).", level=logging.CRITICAL)
        
        await notifier.send_user_blocked_notification(user.id, user.first_name, user.username, strike_count)
        
        return True

    return False