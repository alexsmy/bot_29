import os
import asyncio
import database
from telegram import InputFile
from logger_config import logger

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
        settings = await database.get_admin_settings()
        # Если setting_key передан, проверяем настройку. Если None - отправляем безусловно (для внутренних нужд)
        if setting_key and not settings.get(setting_key, False):
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

async def send_audio_content(file_path: str):
    """Отправляет аудиофайл администратору, если включена настройка."""
    if not _bot_app or not _admin_id:
        return

    try:
        settings = await database.get_admin_settings()
        if not settings.get('send_audio_recording', False):
            return

        bot = _bot_app.bot
        with open(file_path, 'rb') as audio_file:
            await bot.send_audio(
                chat_id=_admin_id,
                audio=InputFile(audio_file, filename=os.path.basename(file_path)),
                caption=f"🎤 Аудиозапись: {os.path.basename(file_path)}"
            )
        logger.info(f"Администратору отправлена аудиозапись: {os.path.basename(file_path)}")
    except Exception as e:
        logger.error(f"Ошибка при отправке аудиозаписи: {e}")

async def send_text_content(file_path: str, content_type: str):
    """
    Отправляет текстовый контент (транскрипцию или саммери) администратору.
    content_type: 'transcript' или 'summary'
    """
    if not _bot_app or not _admin_id:
        return

    try:
        settings = await database.get_admin_settings()
        
        setting_enabled_key = f"send_{content_type}" # send_transcript или send_summary
        setting_mode_key = f"{content_type}_mode"     # transcript_mode или summary_mode
        
        if not settings.get(setting_enabled_key, False):
            return

        mode = settings.get(setting_mode_key, 'file')
        bot = _bot_app.bot
        filename = os.path.basename(file_path)
        
        if mode == 'file':
            with open(file_path, 'rb') as doc_file:
                await bot.send_document(
                    chat_id=_admin_id,
                    document=InputFile(doc_file, filename=filename),
                    caption=f"📄 {content_type.capitalize()}: {filename}"
                )
            logger.info(f"Администратору отправлен файл {content_type}: {filename}")
            
        elif mode == 'message':
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            
            header = f"📝 <b>{content_type.capitalize()} ({filename})</b>\n\n"
            full_text = header + text
            
            # Telegram имеет лимит 4096 символов. Разбиваем сообщение.
            max_len = 4000
            parts = [full_text[i:i+max_len] for i in range(0, len(full_text), max_len)]
            
            for part in parts:
                await bot.send_message(
                    chat_id=_admin_id,
                    text=part,
                    parse_mode='HTML' if part == parts[0] else None # HTML только для заголовка
                )
            logger.info(f"Администратору отправлен текст {content_type} сообщением.")

    except Exception as e:
        logger.error(f"Ошибка при отправке текстового контента ({content_type}): {e}")

def schedule_notification(*args, **kwargs):
    asyncio.run_coroutine_threadsafe(send_admin_notification(*args, **kwargs), _bot_app.loop)