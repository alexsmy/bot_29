from __future__ import annotations

import asyncio
import os

from utils.logger import log

try:
    from aiogram import Bot, Dispatcher
    from aiogram.client.default import DefaultBotProperties
    from aiogram.enums import ParseMode
    from aiogram.types import BotCommand
    AIROGRAM_AVAILABLE = True
except ModuleNotFoundError:
    Bot = Dispatcher = DefaultBotProperties = ParseMode = BotCommand = None  # type: ignore[assignment]
    AIROGRAM_AVAILABLE = False

if AIROGRAM_AVAILABLE:
    from .handlers.filevault import router as filevault_router
    from .handlers.hub import router as hub_router
    from .handlers.media import router as media_router
    from .handlers.support import router as support_router
    from .handlers.time import router as time_router
    from .time_store import clock_update_loop
    from .middleware import AllowedUsersMiddleware
else:
    filevault_router = hub_router = media_router = support_router = time_router = None
    clock_update_loop = None


def build_dispatcher() -> Dispatcher:
    if not AIROGRAM_AVAILABLE:
        raise RuntimeError("aiogram is not installed")
    dp = Dispatcher()
    dp.include_router(hub_router)
    dp.include_router(support_router)
    dp.include_router(filevault_router)
    dp.include_router(media_router)
    dp.include_router(time_router)
    guard = AllowedUsersMiddleware()
    dp.message.middleware(guard)
    dp.callback_query.middleware(guard)
    return dp


async def _setup_commands(bot: Bot) -> None:
    try:
        await bot.set_my_commands(
            [
                BotCommand(command="start", description="Открыть модульный хаб"),
                BotCommand(command="hub", description="Вернуться в хаб"),
            ]
        )
    except Exception as error:
        log("TELEGRAM", f"Не удалось настроить команды бота: {error}")


async def start_telegram_bot() -> None:
    if not AIROGRAM_AVAILABLE:
        log("TELEGRAM", "aiogram не установлен. Telegram-бот не запускается.")
        return

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        log("TELEGRAM", "TELEGRAM_BOT_TOKEN не задан. Telegram-бот не запускается.")
        return

    bot = Bot(
        token=token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML, link_preview_is_disabled=True),
    )
    dp = build_dispatcher()

    await _setup_commands(bot)
    clock_task = asyncio.create_task(clock_update_loop(bot)) if clock_update_loop else None

    try:
        log("TELEGRAM", "Telegram aiogram-бот запущен.")
        await dp.start_polling(bot)
    finally:
        if clock_task is not None:
            clock_task.cancel()
            try:
                await clock_task
            except asyncio.CancelledError:
                pass
        await bot.session.close()
        log("TELEGRAM", "Telegram aiogram-бот остановлен.")
