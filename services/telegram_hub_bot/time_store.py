from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError

from .keyboards import build_time_menu
from .texts import EKB_TZ, fmt_clock


@dataclass(slots=True)
class ClockMessage:
    chat_id: int
    message_id: int


_clock_messages: set[tuple[int, int]] = set()
_clock_lock = asyncio.Lock()


def render_clock_text() -> str:
    return f"<b>{fmt_clock(datetime.now(EKB_TZ))}</b>"


async def register_clock_message(chat_id: int, message_id: int) -> None:
    async with _clock_lock:
        _clock_messages.add((int(chat_id), int(message_id)))


async def unregister_clock_message(chat_id: int, message_id: int) -> None:
    async with _clock_lock:
        _clock_messages.discard((int(chat_id), int(message_id)))


async def snapshot_clock_messages() -> list[ClockMessage]:
    async with _clock_lock:
        return [ClockMessage(chat_id=chat, message_id=mid) for chat, mid in _clock_messages]


def clock_card_text() -> str:
    return (
        "<b>🕒 Текущее время (GMT+5, Екатеринбург)</b>\n\n"
        f"{render_clock_text()}\n\n"
        "Часы обновляются автоматически раз в минуту."
    )


async def update_clock_message(bot: Bot, chat_id: int, message_id: int) -> bool:
    try:
        await bot.edit_message_text(
            chat_id=chat_id,
            message_id=message_id,
            text=clock_card_text(),
            reply_markup=build_time_menu(),
        )
        return True
    except TelegramBadRequest as error:
        text = str(error).lower()
        if "message is not modified" in text:
            return True
        return False
    except (TelegramForbiddenError, TelegramBadRequest):
        return False
    except Exception:
        return False


async def clock_update_loop(bot: Bot) -> None:
    while True:
        now = datetime.now(EKB_TZ)
        next_minute = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
        delay = max(1.0, (next_minute - now).total_seconds())
        await asyncio.sleep(delay)

        messages = await snapshot_clock_messages()
        for item in messages:
            ok = await update_clock_message(bot, item.chat_id, item.message_id)
            if not ok:
                await unregister_clock_message(item.chat_id, item.message_id)
