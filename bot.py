import os
import sys
import asyncio
import uvicorn
from telegram import BotCommand, Update
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, InlineQueryHandler

import database
import notifier
from main import app as fastapi_app
from logger_config import logger
from config import WEB_APP_URL, BOT_TOKEN

from handlers import public_handlers, admin_handlers, inline_handlers

bot_app_instance = None

async def post_init(application: Application) -> None:
    public_commands = [
        BotCommand("start", "🚀 Запустить приложение для звонков"),
    ]
    await application.bot.set_my_commands(public_commands)
    logger.info("Меню публичных команд успешно установлено.")

    webhook_url = f"{WEB_APP_URL}webhook/{BOT_TOKEN}"
    await application.bot.set_webhook(url=webhook_url)
    logger.info(f"Вебхук успешно установлен по адресу: {webhook_url}")


async def main() -> None:
    global bot_app_instance
    if not BOT_TOKEN:
        logger.critical("Токен бота (BOT_TOKEN) не найден.")
        sys.exit(1)

    await database.get_pool()
    await database.init_db()

    application = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    
    notifier.set_bot_instance(application)

    application.add_handler(CommandHandler("start", public_handlers.start))
    application.add_handler(CommandHandler("admin", admin_handlers.admin_command))

    application.add_handler(CallbackQueryHandler(admin_handlers.admin_panel_link_callback, pattern="^admin_panel_link$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_create_room_menu_callback, pattern="^admin_create_room_menu$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_create_room_callback, pattern=r"^admin_create_room_\d+$"))
    
    application.add_handler(InlineQueryHandler(inline_handlers.handle_inline_query))

    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, public_handlers.handle_text_message))

    bot_app_instance = application

    port = int(os.environ.get("PORT", 8080))
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=port, log_config=None)
    server = uvicorn.Server(config)

    async with application:
        await application.start()
        logger.info("Telegram бот запускается в режиме вебхука...")
        
        await server.serve()
        
        await application.stop()
    
    await database.close_pool()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Приложение останавливается.")