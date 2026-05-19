from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message

from services.telegram_listener import save_incoming_update

from ..callbacks import HubCB, NoopCB
from ..keyboards import build_main_menu
from ..texts import hub_welcome
from ..time_store import unregister_clock_message

router = Router(name="hub")


def _synthetic_update(message: Message) -> dict:
    return {
        "update_id": message.message_id,
        "message": message.model_dump(mode="json"),
    }


async def _show_main(message: Message) -> None:
    await message.answer(hub_welcome(), reply_markup=build_main_menu())


@router.message(CommandStart())
async def start_command(message: Message) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass
    await _show_main(message)


@router.message(Command("hub"))
async def hub_command(message: Message) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass
    await _show_main(message)


@router.callback_query(HubCB.filter(F.action == "main"))
async def hub_actions(callback: CallbackQuery, callback_data: HubCB) -> None:
    await callback.answer()
    if callback.message:
        await unregister_clock_message(callback.message.chat.id, callback.message.message_id)
        await callback.message.edit_text(hub_welcome(), reply_markup=build_main_menu())


@router.callback_query(NoopCB.filter())
async def noop(callback: CallbackQuery, callback_data: NoopCB) -> None:
    await callback.answer("Информационная карточка", show_alert=False)
