from __future__ import annotations

import html
from datetime import datetime
from typing import Any

from zoneinfo import ZoneInfo

LONDON_TZ = ZoneInfo("Europe/London")


def esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""))


def fmt_bytes(value: int | float | None) -> str:
    if value is None:
        return "0 Б"
    size = float(value)
    units = ["Б", "КБ", "МБ", "ГБ", "ТБ"]
    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "Б":
                return f"{int(size)} {unit}"
            return f"{size:.1f} {unit}".replace(".0 ", " ")
        size /= 1024
    return f"{size:.1f} ТБ"


def fmt_clock(dt: datetime | None = None) -> str:
    dt = dt or datetime.now(LONDON_TZ)
    return dt.strftime("%H:%M")


def trim_middle(text: str, limit: int = 36) -> str:
    text = str(text)
    if len(text) <= limit:
        return text
    if limit <= 4:
        return text[:limit]
    head = max(8, limit // 2)
    tail = max(4, limit - head - 1)
    return f"{text[:head]}…{text[-tail:]}"


def fmt_filename(name: str, limit: int = 28) -> str:
    name = str(name)
    if len(name) <= limit:
        return name
    dot = name.rfind(".")
    if dot > 0 and dot < len(name) - 1:
        ext = name[dot:]
        base = name[:dot]
        if len(ext) < limit:
            head = max(6, limit - len(ext) - 1)
            return f"{base[:head]}…{ext}"
    return trim_middle(name, limit)


def hub_welcome() -> str:
    return (
        "<b>Модульный Хаб</b>\n\n"
        "Выберите раздел внизу. "
        "Все меню поддерживают кнопки <b>◀️Назад</b> и <b>🏠Хаб</b>."
    )


def support_dashboard(total: int, online: int, offline: int, checks: int, title: str = "Автоподдержка") -> str:
    return (
        f"<b>🌍 {esc(title)}</b>\n\n"
        f"Всего: <b>{total}</b>\n"
        f"Онлайн: <b>{online}</b>\n"
        f"Оффлайн: <b>{offline}</b>\n"
        f"Проверок: <b>{checks}</b>\n\n"
        "Нажмите на карточку сервиса для просмотра подробностей."
    )


def support_target_card(name: str, status: str, response_time_ms: int | None, checks: int, url: str, enabled: bool) -> str:
    status_icon = "🟢" if status == "Онлайн" else "🔴"
    state = "активен" if enabled else "пауза"
    response = f"{response_time_ms} мс" if response_time_ms is not None else "—"
    return (
        f"<b>{esc(name)}</b> {status_icon}\n\n"
        f"Статус: <b>{esc(status)}</b>\n"
        f"Состояние: <b>{state}</b>\n"
        f"⏳ {response}\n"
        f"🌐 Проверок: <b>{checks}</b>\n"
        f"URL: <code>{esc(url)}</code>"
    )


def support_settings_intro(title: str = "Настройки автоподдержки") -> str:
    return (
        f"<b>{esc(title)}</b>\n\n"
        "Для доступа к этому разделу нужен PIN-код."
    )


def support_settings_menu(min_wait: int, max_wait: int, timeout: int, targets_count: int) -> str:
    return (
        "<b>⚙️ Настройки автоподдержки</b>\n\n"
        f"Точек контроля: <b>{targets_count}</b>\n"
        f"Интервал: <b>{min_wait}–{max_wait}</b> мин.\n"
        f"Таймаут запроса: <b>{timeout}</b> сек.\n\n"
        "Выберите target для редактирования или добавьте новый."
    )


def support_target_settings(name: str, url: str, enabled: bool, target_id: str, checks: int, response_time_ms: int | None) -> str:
    state = "активен" if enabled else "на паузе"
    response = f"{response_time_ms} мс" if response_time_ms is not None else "—"
    return (
        f"<b>Карточка target</b>\n\n"
        f"Имя: <b>{esc(name)}</b>\n"
        f"ID: <code>{esc(target_id)}</code>\n"
        f"Статус: <b>{state}</b>\n"
        f"URL: <code>{esc(url)}</code>\n"
        f"⏳ {response}\n"
        f"🌐 Проверок: <b>{checks}</b>"
    )


def filevault_dashboard(files: int, folders: int, free_space: str) -> str:
    return (
        "<b>🗂️ Файловое хранилище</b>\n\n"
        f"Файлов: <b>{files}</b>\n"
        f"Папок: <b>{folders}</b>\n"
        f"Свободно: <b>{free_space}</b>\n\n"
        "Откройте папку, чтобы просматривать содержимое."
    )


def filevault_folder(title: str, path_label: str, files_count: int, folders_count: int, size_label: str) -> str:
    return (
        f"<b>{esc(title)}</b>\n\n"
        f"Путь: <code>{esc(path_label)}</code>\n"
        f"Файлов: <b>{files_count}</b>\n"
        f"Папок: <b>{folders_count}</b>\n"
        f"Размер: <b>{esc(size_label)}</b>\n\n"
        "Кнопки ниже показывают содержимое текущей папки."
    )


def file_info(name: str, size_label: str, uploaded_at: str, file_id: str, folder_path: str) -> str:
    return (
        "<b>Информация о файле</b>\n\n"
        f"Имя: <code>{esc(name)}</code>\n"
        f"Размер: <b>{esc(size_label)}</b>\n"
        f"Загружен: <b>{esc(uploaded_at)}</b>\n"
        f"ID: <code>{esc(file_id)}</code>\n"
        f"Папка: <code>{esc(folder_path)}</code>"
    )


def folder_info(name: str, path_label: str, files_count: int, size_label: str) -> str:
    return (
        "<b>Информация о папке</b>\n\n"
        f"Имя: <b>{esc(name)}</b>\n"
        f"Путь: <code>{esc(path_label)}</code>\n"
        f"Файлов: <b>{files_count}</b>\n"
        f"Размер: <b>{esc(size_label)}</b>"
    )


def radio_card() -> str:
    return (
        "<b>📻 Vibe радио</b>\n\n"
        "Лёгкое радио-приложение для прослушивания музыки в веб-версии."
    )


def code_builder_card() -> str:
    return (
        "<b>🧩 Сборщик кода</b>\n\n"
        "Веб-модуль для сборки, анализа и компоновки кода из набора проектов."
    )


def crypto_card() -> str:
    return (
        "<b>🔐 Шифратор</b>\n\n"
        "Структура модуля уже добавлена. Функциональные экраны и алгоритмы будут подключены следующим этапом."
    )


def crypto_stub(name: str) -> str:
    return (
        f"<b>{esc(name)}</b>\n\n"
        "Заглушка меню: здесь будет отдельная логика шифрования, выбора файлов, ключей и истории."
    )


def time_card(now_text: str) -> str:
    return (
        "<b>🕒 Текущее время</b>\n\n"
        f"<b>{esc(now_text)}</b>\n\n"
        "Часы обновляются автоматически раз в минуту."
    )
