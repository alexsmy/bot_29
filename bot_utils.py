import os
import asyncio
import logging
from telegram import Update
from telegram.ext import ContextTypes

import database
import notifier
from configurable_logger import log
from config import SPAM_STRIKE_LIMIT, SPAM_TIME_WINDOW_MINUTES

def format_hours(hours: int) -> str:
    """
    Корректно форматирует слово 'час' в зависимости от числа.
    """
    if hours % 10 == 1 and hours % 100 != 11:
        return f"{hours} час"
    elif 2 <= hours % 10 <= 4 and (hours % 100 < 10 or hours % 100 >= 20):
        return f"{hours} часа"
    else:
        return f"{hours} часов"

def read_template_content(filename: str, replacements: dict = None) -> str:
    """
    Читает содержимое файла из папки templates и выполняет замены.
    """
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
    """
    Логирует информацию о пользователе и его действии в базе данных.
    ИСПРАВЛЕНО: теперь операции выполняются последовательно, чтобы избежать race condition.
    """
    user = update.effective_user
    # Сначала дожидаемся завершения записи пользователя в БД
    await database.log_user(user.id, user.first_name, user.last_name, user.username)
    # И только потом записываем его действие
    await database.log_bot_action(user.id, action)

# --- НОВАЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ СПАМА ---
async def check_and_handle_spam(update: Update, context: ContextTypes.DEFAULT_TYPE, spam_action_name: str) -> bool:
    """
    Проверяет пользователя на спам-активность.
    Возвращает True, если пользователь заблокирован или был только что заблокирован, иначе False.
    """
    user = update.effective_user
    if not user:
        return True # Игнорируем, если не можем определить пользователя

    # 1. Проверяем, не заблокирован ли пользователь уже
    status = await database.get_user_status(user.id)
    if status == 'blocked':
        log("SPAM_DETECT", f"Получено сообщение от заблокированного пользователя {user.id}. Игнорируем.", level=logging.WARNING)
        return True

    # 2. Логируем "плохое" действие
    await log_user_and_action(update, spam_action_name)

    # 3. Подсчитываем количество "плохих" действий за последнее время
    strike_count = await database.count_spam_strikes(user.id)

    # 4. Если лимит превышен, блокируем пользователя
    if strike_count >= SPAM_STRIKE_LIMIT:
        await database.update_user_status(user.id, 'blocked')
        log("USER_BLOCK", f"Пользователь {user.first_name} (ID: {user.id}) заблокирован за спам. "
                        f"({strike_count} нарушений за {SPAM_TIME_WINDOW_MINUTES} минут).", level=logging.CRITICAL)
        
        # Отправляем уведомление администратору
        await notifier.send_user_blocked_notification(user.id, user.first_name, user.username, strike_count)
        
        return True # Сообщаем, что дальнейшая обработка не нужна

    return False # Пользователь не заблокирован, можно продолжать