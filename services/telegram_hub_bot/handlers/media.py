from __future__ import annotations

from aiogram import Router
from aiogram.types import CallbackQuery

from ..callbacks import CryptoCB, HubCB
from ..keyboards import build_crypto_menu, build_simple_back_home
from ..texts import code_builder_card, crypto_card, crypto_stub, radio_card

router = Router(name="media")


_CRYPTO_STUBS = [
    ("📦 Входящие", "incoming"),
    ("📤 Исходящие", "outgoing"),
    ("🗝 Ключи", "keys"),
    ("🧪 Тесты", "tests"),
    ("⚙️ Настройки", "settings"),
    ("🧱 Каркас API", "api"),
]


@router.callback_query(HubCB.filter())
async def open_media(callback: CallbackQuery, callback_data: HubCB) -> None:
    if callback_data.action not in {"radio", "builder", "crypto"}:
        return

    await callback.answer()
    if not callback.message:
        return

    if callback_data.action == "radio":
        await callback.message.edit_text(
            radio_card(),
            reply_markup=build_simple_back_home(HubCB(action="main").pack()),
        )
        return

    if callback_data.action == "builder":
        await callback.message.edit_text(
            code_builder_card(),
            reply_markup=build_simple_back_home(HubCB(action="main").pack()),
        )
        return

    await callback.message.edit_text(
        crypto_card(),
        reply_markup=build_crypto_menu(
            [(text, CryptoCB(action="stub", section=section).pack()) for text, section in _CRYPTO_STUBS],
            back_callback=HubCB(action="main").pack(),
        ),
    )


@router.callback_query(CryptoCB.filter())
async def crypto_main(callback: CallbackQuery, callback_data: CryptoCB) -> None:
    if callback_data.action != "main":
        return

    await callback.answer()
    if not callback.message:
        return

    await callback.message.edit_text(
        crypto_card(),
        reply_markup=build_crypto_menu(
            [(text, CryptoCB(action="stub", section=section).pack()) for text, section in _CRYPTO_STUBS],
            back_callback=HubCB(action="main").pack(),
        ),
    )


@router.callback_query(CryptoCB.filter())
async def crypto_stub_pages(callback: CallbackQuery, callback_data: CryptoCB) -> None:
    await callback.answer()
    if not callback.message:
        return

    if callback_data.action == "stub":
        await callback.message.edit_text(
            crypto_stub(callback_data.section or "Раздел"),
            reply_markup=build_crypto_menu(
                [(text, CryptoCB(action="stub", section=section).pack()) for text, section in _CRYPTO_STUBS],
                back_callback=CryptoCB(action="main").pack(),
            ),
        )
        return
