from __future__ import annotations

from aiogram import Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from services.telegram_listener import save_incoming_update

from ..callbacks import HubCB, SupportCB
from ..keyboards import build_simple_back_home, build_support_dashboard, build_support_settings, build_support_target
from ..keepalive_store import (
    add_target,
    check_pin,
    delete_target,
    get_snapshot,
    get_target_stats,
    lock_settings,
    settings_unlocked,
    unlock_settings,
    update_global_interval,
    update_target,
)
from ..state import SupportStates
from ..texts import support_dashboard, support_settings_intro, support_settings_menu, support_target_card, support_target_settings

router = Router(name="support")


def _synthetic_update(message: Message) -> dict:
    return {
        "update_id": message.message_id,
        "message": message.model_dump(mode="json"),
    }


def _stats_cards(snapshot) -> list[tuple[str, str]]:
    return [
        (f"📊{snapshot.total}", SupportCB(action="noop").pack()),
        (f"✅{snapshot.online}", SupportCB(action="noop").pack()),
        (f"📴{snapshot.offline}", SupportCB(action="noop").pack()),
        (f"#️⃣{snapshot.checks}", SupportCB(action="noop").pack()),
    ]


def _target_button_text(target: dict, stat: dict) -> str:
    status = str(stat.get("status") or ("Онлайн" if target.get("enabled", True) else "Пауза"))
    icon = "🟢" if status == "Онлайн" else "🔴"
    response = stat.get("response_time_ms")
    response_label = f"⏳{response}" if response not in {None, ""} else "⏳-"
    checks = int(stat.get("success_count", 0) or 0) + int(stat.get("fail_count", 0) or 0)
    checks_label = f"🌐{checks}"
    return f"{str(target.get('name', 'Target'))} {icon}, {response_label}, {checks_label}"


async def _render_dashboard(message: Message) -> None:
    snapshot = get_snapshot()
    stats_map = {str(item.get("id")): item for item in snapshot.stats}
    target_buttons = [
        (_target_button_text(target, stats_map.get(str(target.get("id")), {})), SupportCB(action="target", target_id=str(target.get("id"))).pack())
        for target in snapshot.config.get("targets", [])
    ]
    await message.answer(
        support_dashboard(snapshot.total, snapshot.online, snapshot.offline, snapshot.checks),
        reply_markup=build_support_dashboard(_stats_cards(snapshot), target_buttons),
    )


async def _render_settings(message: Message) -> None:
    snapshot = get_snapshot()
    settings = snapshot.config.get("settings", {})
    stats_map = {str(item.get("id")): item for item in snapshot.stats}
    target_buttons = [
        (
            f"{str(target.get('name', 'Target'))} {'🟢' if str(stats_map.get(str(target.get('id')), {}).get('status', '')).lower() == 'онлайн' or target.get('enabled', True) else '🔴'}",
            SupportCB(action="target", target_id=str(target.get("id"))).pack(),
        )
        for target in snapshot.config.get("targets", [])
    ]
    await message.answer(
        support_settings_menu(
            int(settings.get("min_wait_minutes", 13)),
            int(settings.get("max_wait_minutes", 14)),
            int(settings.get("request_timeout_seconds", 30)),
            len(snapshot.config.get("targets", [])),
        ),
        reply_markup=build_support_settings(target_buttons, pinned=True),
    )


async def _render_target(message: Message, target_id: str) -> None:
    snapshot = get_snapshot()
    target = next((item for item in snapshot.config.get("targets", []) if str(item.get("id")) == str(target_id)), None)
    if not target:
        await message.answer("Target не найден.")
        return
    stat = get_target_stats(target_id)
    text = support_target_card(
        str(target.get("name", "Target")),
        str(stat.get("status") or ("Онлайн" if target.get("enabled", True) else "Пауза")),
        stat.get("response_time_ms"),
        int(stat.get("success_count", 0) or 0) + int(stat.get("fail_count", 0) or 0),
        str(target.get("url", "")),
        bool(target.get("enabled", True)),
    )
    actions = [
        ("URL", SupportCB(action="edit_url", target_id=str(target_id)).pack()),
        ("Пауза/Старт", SupportCB(action="toggle", target_id=str(target_id)).pack()),
        ("Переименовать", SupportCB(action="rename", target_id=str(target_id)).pack()),
        ("Удалить", SupportCB(action="delete", target_id=str(target_id)).pack()),
        ("◀️Назад", SupportCB(action="settings").pack()),
        ("🏠Хаб", HubCB(action="main").pack()),
    ]
    await message.answer(text, reply_markup=build_support_target(actions))


@router.callback_query(HubCB.filter())
async def open_support(callback: CallbackQuery, callback_data: HubCB) -> None:
    if callback_data.action != "support":
        return
    await callback.answer()
    if callback.message:
        await callback.message.edit_text(
            support_dashboard(*_dashboard_numbers()),
            reply_markup=build_support_dashboard(*_dashboard_buttons()),
        )


def _dashboard_numbers():
    snapshot = get_snapshot()
    return snapshot.total, snapshot.online, snapshot.offline, snapshot.checks


def _dashboard_buttons():
    snapshot = get_snapshot()
    stats_cards = _stats_cards(snapshot)
    stats_map = {str(item.get("id")): item for item in snapshot.stats}
    target_buttons = [
        (_target_button_text(target, stats_map.get(str(target.get("id")), {})), SupportCB(action="target", target_id=str(target.get("id"))).pack())
        for target in snapshot.config.get("targets", [])
    ]
    return stats_cards, target_buttons


@router.callback_query(SupportCB.filter())
async def support_callbacks(callback: CallbackQuery, callback_data: SupportCB, state: FSMContext) -> None:
    await callback.answer()
    if not callback.message:
        return

    action = callback_data.action

    if action == "noop":
        return

    if action == "settings":
        if not settings_unlocked(callback.message.chat.id):
            await state.set_state(SupportStates.waiting_pin)
            await state.update_data(next_action="settings")
            await callback.message.edit_text(
                support_settings_intro(),
                reply_markup=build_simple_back_home(HubCB(action="main").pack()),
            )
            return
        await _show_settings(callback.message)
        return

    if action == "target":
        await _render_target(callback.message, callback_data.target_id)
        return

    if action == "toggle":
        try:
            _toggle_target(callback_data.target_id)
        except Exception as error:
            await callback.message.edit_text(f"Не удалось изменить состояние: {error}")
            return
        await _render_target(callback.message, callback_data.target_id)
        return

    if action == "delete":
        try:
            delete_target(callback_data.target_id)
        except Exception as error:
            await callback.message.edit_text(f"Не удалось удалить target: {error}")
            return
        await callback.message.edit_text("Target удалён.")
        await _show_settings(callback.message)
        return

    if action == "edit_url":
        await state.set_state(SupportStates.waiting_target_url)
        await state.update_data(target_id=callback_data.target_id)
        await callback.message.edit_text(
            "Отправьте новый URL для target одним сообщением.",
            reply_markup=build_simple_back_home(SupportCB(action="target", target_id=callback_data.target_id).pack()),
        )
        return

    if action == "rename":
        await state.set_state(SupportStates.waiting_target_rename)
        await state.update_data(target_id=callback_data.target_id)
        await callback.message.edit_text(
            "Отправьте новое имя target одним сообщением.",
            reply_markup=build_simple_back_home(SupportCB(action="target", target_id=callback_data.target_id).pack()),
        )
        return

    if action == "add_target":
        await state.set_state(SupportStates.waiting_target_create)
        await callback.message.edit_text(
            "Отправьте новый target в формате:\n<code>Название | https://site.com</code>",
            reply_markup=build_simple_back_home(SupportCB(action="settings").pack()),
        )
        return

    if action == "intervals":
        await state.set_state(SupportStates.waiting_interval)
        settings = get_snapshot().config.get("settings", {})
        await callback.message.edit_text(
            "Введите интервал в минутах в формате:\n<code>13-14</code>\n\n"
            f"Текущее значение: <b>{settings.get('min_wait_minutes', 13)}–{settings.get('max_wait_minutes', 14)}</b>",
            reply_markup=build_simple_back_home(SupportCB(action="settings").pack()),
        )
        return

    if action == "lock":
        lock_settings(callback.message.chat.id)
        await callback.message.edit_text(
            "Настройки закрыты.",
            reply_markup=build_simple_back_home(HubCB(action="main").pack()),
        )
        await _render_dashboard(callback.message)
        return


@router.message(SupportStates.waiting_pin)
async def process_pin(message: Message, state: FSMContext) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass

    pin = (message.text or "").strip()
    if not pin:
        await message.answer("PIN не должен быть пустым.")
        return
    if not check_pin(pin):
        await message.answer("PIN неверный. Попробуйте ещё раз.")
        return

    unlock_settings(message.chat.id)
    await state.clear()
    await message.answer("PIN принят. Доступ открыт.")
    await _show_settings(message)


@router.message(SupportStates.waiting_target_create)
async def process_new_target(message: Message, state: FSMContext) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass

    text = (message.text or "").strip()
    if "|" not in text:
        await message.answer("Нужен формат: Название | https://site.com")
        return
    name, url = [part.strip() for part in text.split("|", 1)]
    if not name or not url:
        await message.answer("И название, и URL должны быть заполнены.")
        return
    try:
        add_target(name, url)
    except Exception as error:
        await message.answer(f"Не удалось добавить target: {error}")
        return
    await state.clear()
    await message.answer("Target добавлен.")
    await _show_settings(message)


@router.message(SupportStates.waiting_target_url)
async def process_target_url(message: Message, state: FSMContext) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass

    data = await state.get_data()
    target_id = str(data.get("target_id", ""))
    url = (message.text or "").strip()
    if not url:
        await message.answer("URL не должен быть пустым.")
        return
    try:
        update_target(target_id, url=url)
    except Exception as error:
        await message.answer(f"Не удалось обновить URL: {error}")
        return
    await state.clear()
    await message.answer("URL обновлён.")
    await _render_target(message, target_id)


@router.message(SupportStates.waiting_target_rename)
async def process_target_rename(message: Message, state: FSMContext) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass

    data = await state.get_data()
    target_id = str(data.get("target_id", ""))
    name = (message.text or "").strip()
    if not name:
        await message.answer("Имя не должно быть пустым.")
        return
    try:
        update_target(target_id, name=name)
    except Exception as error:
        await message.answer(f"Не удалось переименовать target: {error}")
        return
    await state.clear()
    await message.answer("Имя обновлено.")
    await _render_target(message, target_id)


@router.message(SupportStates.waiting_interval)
async def process_interval(message: Message, state: FSMContext) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass

    text = (message.text or "").strip().replace(" ", "")
    if "-" not in text:
        await message.answer("Нужен формат 13-14.")
        return
    left, right = text.split("-", 1)
    try:
        min_wait = int(left)
        max_wait = int(right)
    except ValueError:
        await message.answer("Введите только числа, например 13-14.")
        return
    if min_wait < 1 or max_wait < min_wait:
        await message.answer("Проверьте порядок значений.")
        return
    try:
        update_global_interval(min_wait, max_wait)
    except Exception as error:
        await message.answer(f"Не удалось сохранить интервалы: {error}")
        return
    await state.clear()
    await message.answer("Интервалы сохранены.")
    await _show_settings(message)


async def _show_settings(message: Message) -> None:
    snapshot = get_snapshot()
    settings = snapshot.config.get("settings", {})
    stats_map = {str(item.get("id")): item for item in snapshot.stats}
    target_buttons = [
        (
            f"{str(target.get('name', 'Target'))} {'🟢' if str(stats_map.get(str(target.get('id')), {}).get('status', '')).lower() == 'онлайн' or target.get('enabled', True) else '🔴'}",
            SupportCB(action="target", target_id=str(target.get("id"))).pack(),
        )
        for target in snapshot.config.get("targets", [])
    ]
    await message.answer(
        support_settings_menu(
            int(settings.get("min_wait_minutes", 13)),
            int(settings.get("max_wait_minutes", 14)),
            int(settings.get("request_timeout_seconds", 30)),
            len(snapshot.config.get("targets", [])),
        ),
        reply_markup=build_support_settings(target_buttons, pinned=True),
    )


def _toggle_target(target_id: str) -> dict:
    snapshot = get_snapshot()
    target = next((item for item in snapshot.config.get("targets", []) if str(item.get("id")) == str(target_id)), None)
    if not target:
        raise ValueError("Target не найден")
    enabled = not bool(target.get("enabled", True))
    return update_target(target_id, enabled=enabled)
