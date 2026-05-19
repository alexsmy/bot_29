import asyncio

from aiogram import Bot, Dispatcher

from services.telegram_hub.config import BOT_TOKEN
from services.telegram_hub.handlers import router
from utils.logger import log

async def run_telegram_bot():
    if not BOT_TOKEN:
        log("TELEGRAM", "TELEGRAM_BOT_TOKEN не задан")
        return

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()

    dp.include_router(router)

    log("TELEGRAM", "Telegram Hub Bot запущен")

    await dp.start_polling(bot)
