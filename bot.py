
import os
import sys
import asyncio
import uvicorn
from telegram import BotCommand
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, InlineQueryHandler

import database
import notifier
from main import app as fastapi_app
from logger_config import logger

# Импортируем обработчики из новых модулей
from handlers import public_handlers, admin_handlers, inline_handlers
# ИМПОРТИРУЕМ НОВЫЙ МОДУЛЬ
from keep_alive import start_keep_alive_task

bot_app_instance = None

async def post_init(application: Application) -> None:
    """
    Устанавливает команды меню бота после его инициализации.
    """
    public_commands = [
        BotCommand("start", "🚀 Создать новую ссылку для звонка"),
        BotCommand("instructions", "📖 Как пользоваться ботом"),
        BotCommand("faq", "❓ Ответы на частые вопросы"),
    ]
    await application.bot.set_my_commands(public_commands)
    logger.info("Меню публичных команд успешно установлено.")

async def main() -> None:
    """
    Главная функция, которая настраивает и запускает приложение.
    """
    global bot_app_instance
    bot_token = os.environ.get("BOT_TOKEN")
    if not bot_token:
        logger.critical("Токен бота (BOT_TOKEN) не найден.")
        sys.exit(1)

    # Инициализация базы данных
    await database.get_pool()
    await database.init_db()

    # Создание экземпляра приложения бота
    application = Application.builder().token(bot_token).post_init(post_init).build()
    
    # Передача экземпляра бота в модуль уведомлений
    notifier.set_bot_instance(application)

    # Регистрация обработчиков команд
    application.add_handler(CommandHandler("start", public_handlers.start))
    application.add_handler(CommandHandler("instructions", public_handlers.instructions))
    application.add_handler(CommandHandler("faq", public_handlers.faq))
    application.add_handler(CommandHandler("admin", admin_handlers.admin_command))

    # Регистрация обработчиков callback-запросов (нажатий на кнопки)
    application.add_handler(CallbackQueryHandler(public_handlers.handle_create_link_callback, pattern="^create_private_link$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_panel_link_callback, pattern="^admin_panel_link$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_create_room_menu_callback, pattern="^admin_create_room_menu$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_create_room_callback, pattern=r"^admin_create_room_\d+$"))
    
    # Регистрация обработчика inline-запросов
    application.add_handler(InlineQueryHandler(inline_handlers.handle_inline_query))

    # --- ИЗМЕНЕНИЕ: Разделяем обработчик текста и вложений ---
    # 1. Обработчик для всех текстовых сообщений, которые не являются командами
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, public_handlers.echo))
    # 2. Новый обработчик для всех типов вложений (фото, видео, файлы, аудио и т.д.)
    application.add_handler(MessageHandler(filters.ATTACHMENT, public_handlers.handle_attachment))
    # --- КОНЕЦ ИЗМЕНЕНИЯ ---

    bot_app_instance = application

    # Настройка и запуск веб-сервера Uvicorn
    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=port, log_config=None)
    server = uvicorn.Server(config)

    # Асинхронный запуск бота и сервера
    async with application:
        await application.start()
        logger.info("Telegram бот запускается...")
        
        server_task = asyncio.create_task(server.serve())
        bot_task = asyncio.create_task(application.updater.start_polling())
        # СОЗДАЕМ И ЗАПУСКАЕМ ЗАДАЧУ САМОПОДДЕРЖКИ
        keep_alive_task = asyncio.create_task(start_keep_alive_task())
        
        # ДОБАВЛЯЕМ ЗАДАЧУ В ОБЩИЙ ПУЛ
        await asyncio.gather(server_task, bot_task, keep_alive_task)
        
        await application.stop()
    
    # Корректное закрытие пула соединений с БД
    await database.close_pool()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Приложение останавливается.")