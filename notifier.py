# notifier.py

import os
import asyncio
import database
from telegram import InputFile
from logger_config import logger
from admin_ws_manager import broadcast_event

_bot_app = None
_admin_id = os.environ.get("ADMIN_USER_ID")

def set_bot_instance(app):
    global _bot_app
    _bot_app = app
    logger.info("Экземпляр бота успешно установлен в модуле уведомлений.")

async def send_admin_notification(message: str, setting_key: str, file_path: str = None):
    if not _bot_app or not _admin_id:
        logger.warning("Попытка отправить уведомление, но бот или ADMIN_USER_ID не настроены.")
        return

    try:
        settings = await database.get_notification_settings()
        if not settings.get(setting_key, False):
            return

        bot = _bot_app.bot
        if file_path:
            with open(file_path, 'rb') as document_file:
                await bot.send_document(
                    chat_id=_admin_id,
                    document=InputFile(document_file, filename=os.path.basename(file_path)),
                    caption=message,
                    parse_mode='HTML',
                    disable_notification=False 
                )
            logger.info(f"Администратору отправлен отчет '{setting_key}' с файлом {os.path.basename(file_path)}.")
        else:
            await bot.send_message(
                chat_id=_admin_id, 
                text=message, 
                parse_mode='HTML',
                disable_web_page_preview=True
            )
            logger.info(f"Администратору отправлено уведомление '{setting_key}'.")

    except Exception as e:
        logger.error(f"Не удалось отправить уведомление администратору ('{setting_key}'): {e}")

def schedule_notification(*args, **kwargs):
    asyncio.run_coroutine_threadsafe(send_admin_notification(*args, **kwargs), _bot_app.loop)