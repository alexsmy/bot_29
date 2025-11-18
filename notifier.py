import os
import asyncio
import logging
from telegram import InputFile
from configurable_logger import log
from config import SPAM_TIME_WINDOW_MINUTES
import settings_manager

_bot_app = None
_admin_id = os.environ.get("ADMIN_USER_ID")
TELEGRAM_MESSAGE_LIMIT = 4000

def set_bot_instance(app):
    global _bot_app
    _bot_app = app
    log("APP_LIFECYCLE", "Экземпляр бота успешно установлен в модуле уведомлений.")

async def send_admin_notification(message: str, setting_key: str, file_path: str = None):
    if not _bot_app or not _admin_id:
        log("NOTIFICATION", "Попытка отправить уведомление, но бот или ADMIN_USER_ID не настроены.", level=logging.WARNING)
        return

    try:
        if not settings_manager.get_setting(setting_key):
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
            log("NOTIFICATION", f"Администратору отправлен отчет '{setting_key}' с файлом {os.path.basename(file_path)}.")
        else:
            await bot.send_message(
                chat_id=_admin_id, 
                text=message, 
                parse_mode='HTML',
                disable_web_page_preview=True
            )
            log("NOTIFICATION", f"Администратору отправлено уведомление '{setting_key}'.")

    except Exception as e:
        log("ERROR", f"Не удалось отправить уведомление администратору ('{setting_key}'): {e}", level=logging.ERROR)

async def send_admin_photo_notification(caption: str, setting_key: str, file_path: str):
    if not _bot_app or not _admin_id:
        log("NOTIFICATION", "Попытка отправить фото, но бот или ADMIN_USER_ID не настроены.", level=logging.WARNING)
        return

    try:
        if not settings_manager.get_setting(setting_key):
            return

        bot = _bot_app.bot
        with open(file_path, 'rb') as photo_file:
            await bot.send_photo(
                chat_id=_admin_id,
                photo=InputFile(photo_file, filename=os.path.basename(file_path)),
                caption=caption,
                parse_mode='HTML'
            )
        log("NOTIFICATION", f"Администратору отправлен скриншот '{setting_key}' с файлом {os.path.basename(file_path)}.")

    except Exception as e:
        log("ERROR", f"Не удалось отправить фото администратору ('{setting_key}'): {e}", level=logging.ERROR)

async def send_notification_with_content_handling(message: str, file_path: str, setting_key_file: str, setting_key_message: str):
    if not _bot_app or not _admin_id:
        log("NOTIFICATION", "Попытка отправить уведомление, но бот или ADMIN_USER_ID не настроены.", level=logging.WARNING)
        return

    try:
        bot = _bot_app.bot

        if settings_manager.get_setting(setting_key_file):
            await send_admin_notification(message, setting_key_file, file_path)

        if settings_manager.get_setting(setting_key_message):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                full_message = f"{message}\n\n<pre>{content[:TELEGRAM_MESSAGE_LIMIT]}</pre>"
                if len(content) > TELEGRAM_MESSAGE_LIMIT:
                    full_message += "\n\n<i>(сообщение было обрезано)</i>"

                await bot.send_message(
                    chat_id=_admin_id,
                    text=full_message,
                    parse_mode='HTML'
                )
                log("NOTIFICATION", f"Администратору отправлено содержимое файла '{os.path.basename(file_path)}' как сообщение.")
            except Exception as e:
                log("ERROR", f"Не удалось прочитать или отправить файл {file_path} как сообщение: {e}", level=logging.ERROR)

    except Exception as e:
        log("ERROR", f"Общая ошибка при отправке уведомления с контентом: {e}", level=logging.ERROR)

async def send_user_blocked_notification(user_id: int, first_name: str, username: str, strike_count: int):
    if not _bot_app or not _admin_id:
        return
    
    username_str = f"(@{username})" if username else ""
    message = (
        f"🚫 <b>Пользователь заблокирован за спам!</b>\n\n"
        f"<b>Пользователь:</b> {first_name} {username_str}\n"
        f"<b>ID:</b> <code>{user_id}</code>\n"
        f"<b>Причина:</b> {strike_count} нежелательных действий за последние {SPAM_TIME_WINDOW_MINUTES} минут."
    )
    try:
        await _bot_app.bot.send_message(chat_id=_admin_id, text=message, parse_mode='HTML')
        log("NOTIFICATION", f"Администратору отправлено уведомление о блокировке пользователя {user_id}.")
    except Exception as e:
        log("ERROR", f"Не удалось отправить уведомление о блокировке пользователя {user_id}: {e}", level=logging.ERROR)

async def send_new_user_notification(user_id: int, first_name: str, username: str):
    if not _bot_app or not _admin_id:
        return

    username_str = f"(@{username})" if username else "(нет username)"
    message = (
        f"👋 <b>Новый пользователь в боте!</b>\n\n"
        f"<b>Имя:</b> {first_name}\n"
        f"<b>Username:</b> {username_str}\n"
        f"<b>ID:</b> <code>{user_id}</code>"
    )
    try:
        await _bot_app.bot.send_message(chat_id=_admin_id, text=message, parse_mode='HTML')
        log("NOTIFICATION", f"Администратору отправлено уведомление о новом пользователе {user_id}.")
    except Exception as e:
        log("ERROR", f"Не удалось отправить уведомление о новом пользователе {user_id}: {e}", level=logging.ERROR)

def schedule_notification(*args, **kwargs):
    asyncio.run_coroutine_threadsafe(send_admin_notification(*args, **kwargs), _bot_app.loop)