import os
import sys
import asyncio
import uvicorn
import logging
from telegram import BotCommand
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, InlineQueryHandler, ConversationHandler

import database
import notifier
from main import app as fastapi_app
from configurable_logger import log

from handlers import public_handlers, admin_handlers, inline_handlers
from keep_alive import start_keep_alive_task

bot_app_instance = None

WAITING_FEEDBACK = 0

async def post_init(application: Application) -> None:
    public_commands = [
        BotCommand("start", "🚀 Создать новую ссылку для звонка"),
        BotCommand("instructions", "📖 Как пользоваться ботом"),
        BotCommand("faq", "❓ Ответы на частые вопросы"),
        BotCommand("feedback", "✍️ Отправить отзыв или вопрос"),
    ]
    await application.bot.set_my_commands(public_commands)
    log("BOT_SETUP", "Меню публичных команд успешно установлено.")

async def main() -> None:
    global bot_app_instance
    bot_token = os.environ.get("BOT_TOKEN")
    if not bot_token:
        log("CRITICAL", "Токен бота (BOT_TOKEN) не найден.", level=logging.CRITICAL)
        sys.exit(1)

    await database.get_pool()
    await database.init_db()

    application = Application.builder().token(bot_token).post_init(post_init).build()
    
    notifier.set_bot_instance(application)

    feedback_handler = ConversationHandler(
        entry_points=[CommandHandler("feedback", public_handlers.feedback_start)],
        states={
            WAITING_FEEDBACK: [MessageHandler(filters.TEXT | filters.ATTACHMENT, public_handlers.feedback_receive)],
        },
        fallbacks=[CommandHandler("start", public_handlers.feedback_cancel)],
    )

    application.add_handler(feedback_handler)
    application.add_handler(CommandHandler("start", public_handlers.start))
    application.add_handler(CommandHandler("instructions", public_handlers.instructions))
    application.add_handler(CommandHandler("faq", public_handlers.faq))
    application.add_handler(CommandHandler("admin", admin_handlers.admin_command))

    application.add_handler(CallbackQueryHandler(public_handlers.handle_create_link_callback, pattern="^create_private_link$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_panel_link_callback, pattern="^admin_panel_link$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_create_room_menu_callback, pattern="^admin_create_room_menu$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.admin_create_room_callback, pattern=r"^admin_create_room_\d+$"))
    application.add_handler(CallbackQueryHandler(admin_handlers.create_special_room_callback, pattern="^create_special_room$"))
    
    application.add_handler(InlineQueryHandler(inline_handlers.handle_inline_query))

    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, public_handlers.echo))
    application.add_handler(MessageHandler(filters.ATTACHMENT, public_handlers.handle_attachment))

    bot_app_instance = application

    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=port, log_config=None)
    server = uvicorn.Server(config)

    async with application:
        await application.start()
        log("APP_LIFECYCLE", "Telegram бот запускается...")
        
        server_task = asyncio.create_task(server.serve())
        bot_task = asyncio.create_task(application.updater.start_polling())
        keep_alive_task = asyncio.create_task(start_keep_alive_task())
        
        await asyncio.gather(server_task, bot_task, keep_alive_task)
        
        await application.stop()
    
    await database.close_pool()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log("APP_LIFECYCLE", "Приложение останавливается.")