from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

def hub_keyboard():
    builder = InlineKeyboardBuilder()

    buttons = [
        ("🌍 Автоподдержка", "keepalive"),
        ("🗂️ Файловое хранилище", "files"),
        ("📻 Vibe-радио", "radio"),
        ("🔐 Шифратор", "crypter"),
        ("🧩 Сборщик кода", "builder"),
        ("🕓 Часы", "clock"),
    ]

    for title, callback in buttons:
        builder.button(text=title, callback_data=callback)

    builder.adjust(1)

    return builder.as_markup()

def nav_keyboard(back="hub"):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data=back),
                InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
            ]
        ]
    )
