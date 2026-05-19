from __future__ import annotations

from aiogram import F, Router
from aiogram.types import CallbackQuery

from ..callbacks import HubCB, TimeCB
from ..keyboards import build_time_menu
from ..texts import time_card
from ..time_store import clock_card_text, register_clock_message, unregister_clock_message

router = Router(name="time")


@router.callback_query(HubCB.filter(F.action == "clock"))
async def open_time(callback: CallbackQuery, callback_data: HubCB) -> None:
    await callback.answer()
    if not callback.message:
        return

    await callback.message.edit_text(clock_card_text(), reply_markup=build_time_menu())
    await register_clock_message(callback.message.chat.id, callback.message.message_id)


@router.callback_query(TimeCB.filter())
async def time_actions(callback: CallbackQuery, callback_data: TimeCB) -> None:
    await callback.answer()
    if not callback.message:
        return

    if callback_data.action == "refresh":
        await callback.message.edit_text(clock_card_text(), reply_markup=build_time_menu())
        await register_clock_message(callback.message.chat.id, callback.message.message_id)
        return


@router.callback_query(HubCB.filter(F.action == "main"))
async def time_back_home(callback: CallbackQuery, callback_data: HubCB) -> None:
    await callback.answer()
    if callback.message:
        await unregister_clock_message(callback.message.chat.id, callback.message.message_id)
