import os
import asyncio
from telegram import Update

import database
from logger_config import logger

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
        logger.critical(f"Файл шаблона не найден: {template_path}")
        return "Ошибка: Не удалось загрузить содержимое."

async def log_user_and_action(update: Update, action: str):
    """
    Логирует информацию о пользователе и его действии в базе данных.
    """
    user = update.effective_user
    asyncio.create_task(database.log_user(user.id, user.first_name, user.last_name, user.username))
    asyncio.create_task(database.log_bot_action(user.id, action))