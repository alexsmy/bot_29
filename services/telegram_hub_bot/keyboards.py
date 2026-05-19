from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from .callbacks import CryptoCB, FileVaultCB, HubCB, NoopCB, SupportCB, TimeCB


def _markup(rows: list[list[InlineKeyboardButton]]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _compact_rows(items: list[tuple[str, str]], *, row_width: int = 2, max_text_for_compact: int = 18) -> list[list[InlineKeyboardButton]]:
    if not items:
        return []
    compact = all(len(text) <= max_text_for_compact for text, _ in items)
    if not compact:
        return [[InlineKeyboardButton(text=text, callback_data=callback)] for text, callback in items]
    rows: list[list[InlineKeyboardButton]] = []
    for idx in range(0, len(items), row_width):
        chunk = items[idx: idx + row_width]
        rows.append([InlineKeyboardButton(text=text, callback_data=callback) for text, callback in chunk])
    return rows


def nav_row(back_callback: str, home_callback: str | None = None) -> list[InlineKeyboardButton]:
    return [
        InlineKeyboardButton(text="◀️Назад", callback_data=back_callback),
        InlineKeyboardButton(text="🏠Хаб", callback_data=home_callback or HubCB(action="main").pack()),
    ]


def build_main_menu() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text="🌍 Автоподдержка", callback_data=HubCB(action="support").pack())],
        [InlineKeyboardButton(text="🗂️ Файловое хранилище", callback_data=HubCB(action="files").pack())],
        [InlineKeyboardButton(text="📻 Vibe радио", callback_data=HubCB(action="radio").pack())],
        [InlineKeyboardButton(text="🔐 Шифратор", callback_data=HubCB(action="crypto").pack())],
        [InlineKeyboardButton(text="🧩 Сборщик кода", callback_data=HubCB(action="builder").pack())],
        [InlineKeyboardButton(text="🕒 Часы", callback_data=HubCB(action="clock").pack())],
    ]
    return _markup(rows)


def build_support_dashboard(stats_cards: list[tuple[str, str]], target_buttons: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    rows.append([InlineKeyboardButton(text=text, callback_data=callback) for text, callback in stats_cards])
    for text, callback in target_buttons:
        rows.append([InlineKeyboardButton(text=text, callback_data=callback)])
    rows.append([InlineKeyboardButton(text="Настройки ⚙️", callback_data=SupportCB(action="settings").pack())])
    rows.append(nav_row(HubCB(action="main").pack()))
    return _markup(rows)


def build_support_settings(target_buttons: list[tuple[str, str]], pinned: bool) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [
            InlineKeyboardButton(text="➕ Добавить target", callback_data=SupportCB(action="add_target").pack()),
            InlineKeyboardButton(text="⏱ Интервалы", callback_data=SupportCB(action="intervals").pack()),
        ]
    ]
    for text, callback in target_buttons:
        rows.append([InlineKeyboardButton(text=text, callback_data=callback)])
    if pinned:
        rows.append([InlineKeyboardButton(text="🔒 Закрыть настройки", callback_data=SupportCB(action="lock").pack())])
    rows.append(nav_row(HubCB(action="main").pack()))
    return _markup(rows)


def build_support_target(target_actions: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text=text, callback_data=callback)] for text, callback in target_actions]
    rows.append(nav_row(SupportCB(action="settings").pack()))
    return _markup(rows)


def build_filevault_dashboard(summary: str) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=summary, callback_data=NoopCB(action="noop").pack())],
        [InlineKeyboardButton(text="📁 Открыть хранилище", callback_data=FileVaultCB(action="open", folder_id="").pack())],
        nav_row(HubCB(action="main").pack()),
    ]
    return _markup(rows)


def build_filevault_folder(
    items: list[tuple[str, str]],
    *,
    folder_id: str | None,
    has_parent: bool,
    back_callback: str,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = _compact_rows(items, row_width=2)
    rows.append(
        [
            InlineKeyboardButton(text="📤 Загрузить", callback_data=FileVaultCB(action="upload", folder_id=str(folder_id or "")).pack()),
            InlineKeyboardButton(text="➕ Создать", callback_data=FileVaultCB(action="create_folder", folder_id=str(folder_id or "")).pack()),
        ]
    )
    if has_parent and folder_id is not None:
        rows.append([InlineKeyboardButton(text="🗑 Удалить", callback_data=FileVaultCB(action="delete_folder", folder_id=str(folder_id)).pack())])
    rows.append(nav_row(back_callback))
    return _markup(rows)


def build_filevault_file(detail_actions: list[tuple[str, str]], back_callback: str) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text=text, callback_data=callback)] for text, callback in detail_actions]
    rows.append(nav_row(back_callback))
    return _markup(rows)


def build_crypto_menu(stub_buttons: list[tuple[str, str]], back_callback: str | None = None) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text=text, callback_data=callback)] for text, callback in stub_buttons]
    rows.append(nav_row(back_callback or HubCB(action="main").pack()))
    return _markup(rows)


def build_time_menu() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text="🔄 Обновить", callback_data=TimeCB(action="refresh").pack())],
        nav_row(HubCB(action="main").pack()),
    ]
    return _markup(rows)


def build_simple_back_home(back_callback: str) -> InlineKeyboardMarkup:
    return _markup([nav_row(back_callback)])


def build_noop_stats_button(text: str) -> tuple[str, str]:
    return text, NoopCB(action="noop").pack()
