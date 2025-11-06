# `bot.py`

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

from handlers import public_handlers, admin_handlers, inline_handlers

bot_app_instance = None

async def post_init(application: Application) -> None:
    public_commands = [
        BotCommand("start", "🚀 Запустить приложение для звонков"),
    ]
    await application.bot.set_my_commands(public_commands)
    logger.info("Меню публичных команд успешно установлено.")

async def main() -> None:
    global bot_app_instance
    bot_token = os.environ.get("BOT_TOKEN")
    if not bot_token:
        logger.critical("Токен бота (BOT_TOKEN) не найден.")
        sys.exit(1)

    await database.get_pool()
    await database.init_db()

    application = Application.builder().token(bot_token).post_init(post_init).build()
    
    notifier.set_bot_instance(application)

    application.add_handler(CommandHandler("start", public_handlers.start))
    application.add_handler(CommandHandler("admin", admin_handlers.admin_command))

    application.add_handler(CallbackQueryHandler(admin_handlers.admin_panel_link_callback, pattern="^admin_panel_link$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_create_room_menu_callback, pattern="^admin_create_room_menu$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_create_room_callback, pattern=r"^admin_create_room_\d+$"))
    
    application.add_handler(InlineQueryHandler(inline_handlers.handle_inline_query))

    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, public_handlers.handle_text_message))

    bot_app_instance = application

    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=port, log_config=None)
    server = uvicorn.Server(config)

    async with application:
        await application.start()
        logger.info("Telegram бот запускается...")
        
        server_task = asyncio.create_task(server.serve())
        bot_task = asyncio.create_task(application.updater.start_polling())
        
        await asyncio.gather(server_task, bot_task)
        
        await application.stop()
    
    await database.close_pool()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Приложение останавливается.")