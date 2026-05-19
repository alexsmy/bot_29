import asyncio
from datetime import datetime
from pathlib import Path

from aiogram import Router, F
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

from services.telegram_hub.keyboards import hub_keyboard, nav_keyboard
from services.telegram_hub.file_service import get_items, format_size
from services.telegram_hub.config import FILEVAULT_DIR, TELEGRAM_ADMIN_PIN

router = Router()

user_states = {}

@router.message(CommandStart())
async def start(message: Message):
    await message.answer(
        "👋 Добро пожаловать в «Модульный Хаб»\n\nВыберите раздел:",
        reply_markup=hub_keyboard()
    )

@router.callback_query(F.data == "hub")
async def hub(callback: CallbackQuery):
    await callback.message.edit_text(
        "🏠 Главный дашборд «Модульный Хаб»",
        reply_markup=hub_keyboard()
    )

@router.callback_query(F.data == "keepalive")
async def keepalive(callback: CallbackQuery):
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📊5", callback_data="info"),
                InlineKeyboardButton(text="✅4", callback_data="info"),
                InlineKeyboardButton(text="📴1", callback_data="info"),
                InlineKeyboardButton(text="#️⃣174", callback_data="info"),
            ],
            [InlineKeyboardButton(text="PRIMARY 🟢 ⏳70 🌐200", callback_data="srv_primary")],
            [InlineKeyboardButton(text="ПВЗ 🔴 ⏳- 🌐501", callback_data="srv_pvz")],
            [InlineKeyboardButton(text="Настройки ⚙️", callback_data="settings_pin")],
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data="hub"),
                InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
            ]
        ]
    )

    await callback.message.edit_text(
        "🌍 Автоподдержка\n\nСостояние сервисов:",
        reply_markup=keyboard
    )

@router.callback_query(F.data == "settings_pin")
async def settings_pin(callback: CallbackQuery):
    user_states[callback.from_user.id] = "waiting_pin"

    await callback.message.answer(
        "🔐 Введите PIN-код для доступа к настройкам."
    )

@router.message()
async def state_router(message: Message):
    state = user_states.get(message.from_user.id)

    if state == "waiting_pin":
        if message.text == TELEGRAM_ADMIN_PIN:
            user_states[message.from_user.id] = None

            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="➕ Добавить URL", callback_data="stub")],
                    [InlineKeyboardButton(text="⏸️ Пауза / Включить", callback_data="stub")],
                    [InlineKeyboardButton(text="🗑️ Удалить", callback_data="stub")],
                    [InlineKeyboardButton(text="⏱️ Интервалы", callback_data="stub")],
                    [
                        InlineKeyboardButton(text="◀️ Назад", callback_data="keepalive"),
                        InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
                    ]
                ]
            )

            await message.answer(
                "⚙️ Настройки автоподдержки",
                reply_markup=keyboard
            )
        else:
            await message.answer("❌ Неверный PIN-код")

@router.callback_query(F.data == "files")
async def files(callback: CallbackQuery):
    await render_folder(callback, "")

async def render_folder(callback, folder):
    folders, files = get_items(folder)

    builder = InlineKeyboardBuilder()

    builder.row(
        InlineKeyboardButton(text=f"💾 {len(files)}", callback_data="info"),
        InlineKeyboardButton(text=f"📁 {len(folders)}", callback_data="info"),
        InlineKeyboardButton(text="💿 69Гб", callback_data="info"),
    )

    for item in folders:
        builder.row(
            InlineKeyboardButton(
                text=f"📁 {item.name}",
                callback_data=f"folder:{folder}/{item.name}".strip("/")
            )
        )

    for item in files:
        size = format_size(item.stat().st_size)
        short_name = item.name[:18]

        builder.row(
            InlineKeyboardButton(
                text=f"📄 {short_name} · {size}",
                callback_data=f"file:{folder}/{item.name}".strip("/")
            )
        )

    builder.row(
        InlineKeyboardButton(text="📤 Загрузить", callback_data=f"upload:{folder}"),
        InlineKeyboardButton(text="📁 Создать", callback_data=f"create:{folder}"),
    )

    builder.row(
        InlineKeyboardButton(text="🗑️ Удалить", callback_data=f"delete:{folder}"),
    )

    builder.row(
        InlineKeyboardButton(text="◀️ Назад", callback_data="hub"),
        InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
    )

    text = f"🗂️ Папка: /{folder or 'root'}"

    if isinstance(callback, CallbackQuery):
        await callback.message.edit_text(text, reply_markup=builder.as_markup())
    else:
        await callback.answer(text, reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("folder:"))
async def folder_open(callback: CallbackQuery):
    folder = callback.data.replace("folder:", "")
    await render_folder(callback, folder)

@router.callback_query(F.data.startswith("file:"))
async def file_open(callback: CallbackQuery):
    file_path = callback.data.replace("file:", "")
    path = Path(FILEVAULT_DIR) / file_path

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="⬇️ Скачать", url=f"https://example.com/{file_path}")],
            [InlineKeyboardButton(text="✏️ Переименовать", callback_data="stub")],
            [InlineKeyboardButton(text="🗑️ Удалить", callback_data="stub")],
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data="files"),
                InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
            ]
        ]
    )

    created = datetime.fromtimestamp(path.stat().st_mtime).strftime("%d.%m.%Y %H:%M")

    await callback.message.edit_text(
        f"📄 {path.name}\n\n"
        f"Размер: {format_size(path.stat().st_size)}\n"
        f"Изменён: {created}",
        reply_markup=keyboard
    )

@router.callback_query(F.data == "radio")
async def radio(callback: CallbackQuery):
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🌐 Открыть радио", url="https://example.com/project/radio/radio_18.html")],
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data="hub"),
                InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
            ]
        ]
    )

    await callback.message.edit_text(
        "📻 Vibe Radio\n\nМузыкальный модуль хаба.",
        reply_markup=keyboard
    )

@router.callback_query(F.data == "crypter")
async def crypter(callback: CallbackQuery):
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔐 Зашифровать файл", callback_data="stub")],
            [InlineKeyboardButton(text="🔓 Расшифровать файл", callback_data="stub")],
            [InlineKeyboardButton(text="🧾 История операций", callback_data="stub")],
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data="hub"),
                InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
            ]
        ]
    )

    await callback.message.edit_text(
        "🔐 Шифратор\n\nСтруктура подготовлена для будущей реализации.",
        reply_markup=keyboard
    )

@router.callback_query(F.data == "builder")
async def builder(callback: CallbackQuery):
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🌐 Открыть сборщик", url="https://example.com/project/sbor/sbor.html")],
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data="hub"),
                InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
            ]
        ]
    )

    await callback.message.edit_text(
        "🧩 Сборщик кода\n\nМодуль для объединения и сборки проектов.",
        reply_markup=keyboard
    )

@router.callback_query(F.data == "clock")
async def clock(callback: CallbackQuery):
    now = datetime.now().strftime("%H:%M")

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=f"🕓 {now}", callback_data="clock_refresh")],
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data="hub"),
                InlineKeyboardButton(text="🏠 Хаб", callback_data="hub"),
            ]
        ]
    )

    await callback.message.edit_text(
        "🕓 Текущее время",
        reply_markup=keyboard
    )

@router.callback_query(F.data == "clock_refresh")
async def clock_refresh(callback: CallbackQuery):
    now = datetime.now().strftime("%H:%M")

    await callback.answer(f"Текущее время: {now}", show_alert=False)

@router.callback_query(F.data == "stub")
async def stub(callback: CallbackQuery):
    await callback.answer(
        "Функция подготовлена как модуль-заглушка.",
        show_alert=True
    )
