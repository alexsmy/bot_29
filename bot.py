import os
import sys
import asyncio
from telegram import BotCommand
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, InlineQueryHandler

import database
import notifier
# Убираем импорт FastAPI, так как этот процесс больше не управляет веб-сервером
# from main import app as fastapi_app 
from logger_config import logger

# Импортируем обработчики из новых модулей
from handlers import public_handlers, admin_handlers, inline_handlers

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
    Главная функция, которая настраивает и запускает ТОЛЬКО БОТА.
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

    # Регистрация обработчика для всех остальных текстовых сообщений и вложений
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND | filters.ATTACHMENT, public_handlers.echo))

    bot_app_instance = application

    # Убираем всю логику Uvicorn и FastAPI отсюда
    # Теперь просто запускаем бота в бесконечном цикле
    try:
        logger.info("Telegram бот (worker) запускается...")
        await application.initialize()
        await application.start()
        await application.updater.start_polling()
        # Бесконечный цикл, чтобы процесс не завершился
        while True:
            await asyncio.sleep(3600)
    finally:
        logger.info("Останавливаем Telegram бота...")
        await application.updater.stop()
        await application.stop()
        await application.shutdown()
        await database.close_pool()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Процесс бота останавливается.")