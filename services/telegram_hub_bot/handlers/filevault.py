from __future__ import annotations

import io
from pathlib import Path

from aiogram import Router
from aiogram.enums import ContentType
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, FSInputFile, Message

from routers.filevault_api import (
    _blob_path,
    _folder_children_map,
    _folder_index,
    _folder_path_label,
    _json_write,
    _load_all_file_meta,
    _load_folders,
    _meta_path,
    _now_iso,
    _sanitize_filename,
    _sanitize_folder_name,
    _save_folders,
    _to_client_record,
    _validate_folder_id,
)

from services.telegram_listener import save_incoming_update

from ..callbacks import FileVaultCB, HubCB
from ..filevault_store import (
    create_folder,
    delete_file,
    delete_folder,
    get_dashboard,
    get_file_info,
    list_folder,
    rename_file,
)
from ..keyboards import build_filevault_dashboard, build_filevault_file, build_filevault_folder, build_simple_back_home
from ..state import FileVaultStates
from ..texts import esc, file_info, filevault_dashboard, filevault_folder, fmt_bytes, fmt_filename, folder_info, trim_middle

router = Router(name="filevault")
PAGE_SIZE = 8


def _synthetic_update(message: Message) -> dict:
    return {
        "update_id": message.message_id,
        "message": message.model_dump(mode="json"),
    }


def _root_children() -> list[dict]:
    folders = _load_folders()
    return [folder for folder in folders if folder.get("parent_id") is None]


def _folder_path(folder_id: str | None) -> str:
    folders = _load_folders()
    return _folder_path_label(folder_id, folders)


def _file_label(record: dict) -> str:
    name = str(record.get("original_name", "file"))
    size = fmt_bytes(int(record.get("size_bytes", 0) or 0))
    return f"📄 {fmt_filename(name, 22)} · {size}"


def _folder_label(folder: dict) -> str:
    count = int(folder.get("file_count", 0) or 0)
    return f"📁 {fmt_filename(str(folder.get('name', 'Папка')), 22)} · {count}"


def _folder_items(folder_id: str | None, page: int) -> tuple[list[tuple[str, str]], int, int, dict]:
    folder_id = _validate_folder_id(folder_id)
    folders = _load_folders()
    files = [meta for meta in _load_all_file_meta() if meta.get("folder_id") == folder_id]
    children_map = _folder_children_map(folders)
    child_folders = children_map.get(folder_id, [])
    index = _folder_index(folders)

    folder_objects = []
    if folder_id is None:
        folder_objects = child_folders
    else:
        folder_objects = child_folders

    items: list[tuple[str, str]] = []
    for child_id in folder_objects:
        folder = index[child_id]
        items.append((f"📁 {fmt_filename(folder['name'], 22)}", FileVaultCB(action="folder", folder_id=child_id, page=0).pack()))
    for record in files:
        items.append((_file_label(record), FileVaultCB(action="file", folder_id=str(folder_id or ""), file_id=str(record.get("file_id", "")), page=page).pack()))

    total = len(items)
    pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    page = max(0, min(page, pages - 1))
    start = page * PAGE_SIZE
    end = start + PAGE_SIZE
    return items[start:end], page, pages, {"folder_id": folder_id, "total": total, "folders": child_folders, "files": files}


def _render_folder_markup(folder_id: str | None, page: int) -> tuple[str, object]:
    folder_id = _validate_folder_id(folder_id)
    files = _load_all_file_meta()
    folders = _load_folders()
    index = _folder_index(folders)
    metrics = {}
    if folders:
        from routers.filevault_api import _compute_folder_metrics
        metrics, _ = _compute_folder_metrics(files, folders)

    page_items, page, pages, payload = _folder_items(folder_id, page)

    if folder_id is None:
        title = "Корневая папка"
        path_label = "Корень хранилища"
        folder_files = [meta for meta in files if meta.get("folder_id") is None]
        child_folders = [index[fid] for fid in payload["folders"]]
        file_count = metrics.get(None, {}).get("file_count", len(folder_files))
        size_bytes = metrics.get(None, {}).get("size_bytes", sum(int(x.get("size_bytes", 0) or 0) for x in folder_files))
    else:
        folder = index.get(folder_id)
        if not folder:
            raise ValueError("Папка не найдена")
        title = folder["name"]
        path_label = _folder_path_label(folder_id, folders)
        file_count = metrics.get(folder_id, {}).get("file_count", len(payload["files"]))
        size_bytes = metrics.get(folder_id, {}).get("size_bytes", sum(int(x.get("size_bytes", 0) or 0) for x in payload["files"]))
        child_folders = [index[fid] for fid in payload["folders"]]

    folders_count = len(child_folders)
    text = filevault_folder(title, path_label, file_count, folders_count, fmt_bytes(size_bytes))

    buttons: list[tuple[str, str]] = []
    for item_text, callback in page_items:
        buttons.append((item_text, callback))

    if pages > 1:
        if page > 0:
            buttons.append(("⬅️", FileVaultCB(action="folder", folder_id=str(folder_id or ""), page=page - 1).pack()))
        if page < pages - 1:
            buttons.append(("➡️", FileVaultCB(action="folder", folder_id=str(folder_id or ""), page=page + 1).pack()))

    if folder_id is None:
        back_callback = HubCB(action="files").pack()
    else:
        parent_id = _parent_folder_id(folder_id)
        back_callback = FileVaultCB(action="folder", folder_id=str(parent_id or ""), page=0).pack() if parent_id is not None else HubCB(action="files").pack()

    return text, build_filevault_folder(buttons, folder_id=folder_id, has_parent=folder_id is not None, back_callback=back_callback)


def _parent_folder_id(folder_id: str | None) -> str | None:
    folder_id = _validate_folder_id(folder_id)
    if folder_id is None:
        return None
    folders = _load_folders()
    index = _folder_index(folders)
    folder = index.get(folder_id)
    if not folder:
        return None
    return folder.get("parent_id")


async def _open_folder(callback: CallbackQuery, folder_id: str | None, page: int = 0) -> None:
    if not callback.message:
        return
    text, markup = _render_folder_markup(folder_id, page)
    await callback.message.edit_text(text, reply_markup=markup)


@router.callback_query(HubCB.filter())
async def open_filevault(callback: CallbackQuery, callback_data: HubCB) -> None:
    if callback_data.action != "files":
        return
    await callback.answer()
    if not callback.message:
        return
    dashboard = get_dashboard()
    text = filevault_dashboard(dashboard["files_count"], dashboard["folders_count"], dashboard["disk_free_label"])
    await callback.message.edit_text(text, reply_markup=build_filevault_dashboard())


@router.callback_query(FileVaultCB.filter())
async def filevault_actions(callback: CallbackQuery, callback_data: FileVaultCB, state: FSMContext) -> None:
    await callback.answer()
    if not callback.message:
        return

    action = callback_data.action
    folder_id = _validate_folder_id(callback_data.folder_id or None)
    page = int(callback_data.page or 0)

    if action == "open":
        await _open_folder(callback, folder_id, page)
        return

    if action == "roots":
        if callback.message:
            folders = _root_children()
            items = [
                (f"📁 {fmt_filename(folder['name'], 22)}", FileVaultCB(action="folder", folder_id=str(folder["folder_id"]), page=0).pack())
                for folder in folders
            ]
            dashboard = get_dashboard()
            text = filevault_dashboard(dashboard["files_count"], dashboard["folders_count"], dashboard["disk_free_label"])
            await callback.message.edit_text(text, reply_markup=build_filevault_folder(items, folder_id=None, has_parent=False, back_callback=HubCB(action="files").pack()))
        return

    if action == "folder":
        await _open_folder(callback, folder_id, page)
        return

    if action == "parent":
        parent_id = _parent_folder_id(folder_id)
        await _open_folder(callback, parent_id, 0)
        return

    if action == "upload":
        await state.set_state(FileVaultStates.waiting_upload)
        await state.update_data(folder_id=folder_id)
        await callback.message.edit_text(
            "Файл загружается в текущую папку.\n\nОтправьте документ, чтобы сохранить его в этом разделе.",
            reply_markup=build_simple_back_home(FileVaultCB(action="open", folder_id=str(folder_id or ""), page=page).pack()),
        )
        return

    if action == "create_folder":
        await state.set_state(FileVaultStates.waiting_folder_create)
        await state.update_data(parent_id=folder_id, page=page)
        await callback.message.edit_text(
            "Введите название новой папки.",
            reply_markup=build_simple_back_home(FileVaultCB(action="open", folder_id=str(folder_id or ""), page=page).pack()),
        )
        return

    if action == "delete_folder":
        if folder_id is None:
            await callback.message.edit_text("Корневую папку удалять нельзя.")
            return
        delete_folder(folder_id)
        await callback.message.edit_text("Папка удалена.")
        await _open_folder(callback, _parent_folder_id(folder_id), 0)
        return

    if action == "file":
        file_id = callback_data.file_id
        info = get_file_info(file_id)
        text = file_info(
            str(info.get("original_name", "file")),
            fmt_bytes(int(info.get("size_bytes", 0) or 0)),
            str(info.get("uploaded_at", "")),
            str(info.get("file_id", "")),
            str(info.get("folder_path", "")),
        )
        await callback.message.edit_text(
            text,
            reply_markup=build_filevault_file(
                [
                    ("Скачать", FileVaultCB(action="download", folder_id=str(folder_id or ""), file_id=file_id, page=page).pack()),
                    ("Переименовать", FileVaultCB(action="rename_file", folder_id=str(folder_id or ""), file_id=file_id, page=page).pack()),
                    ("Удалить", FileVaultCB(action="delete_file", folder_id=str(folder_id or ""), file_id=file_id, page=page).pack()),
                ],
                back_callback=FileVaultCB(action="folder", folder_id=str(folder_id or ""), page=page).pack(),
            ),
        )
        return

    if action == "download":
        info = get_file_info(callback_data.file_id)
        path = _blob_path(callback_data.file_id)
        if not path.exists():
            await callback.message.edit_text("Файл не найден.")
            return
        await callback.message.answer_document(FSInputFile(path, filename=str(info.get("original_name", path.name))))
        await callback.answer("Файл отправлен.", show_alert=False)
        return

    if action == "rename_file":
        await state.set_state(FileVaultStates.waiting_file_rename)
        await state.update_data(file_id=callback_data.file_id, folder_id=folder_id, page=page)
        await callback.message.edit_text(
            "Введите новое имя файла полностью, включая расширение.",
            reply_markup=build_simple_back_home(FileVaultCB(action="file", folder_id=str(folder_id or ""), file_id=callback_data.file_id, page=page).pack()),
        )
        return

    if action == "delete_file":
        delete_file(callback_data.file_id)
        await callback.message.edit_text("Файл удалён.")
        await _open_folder(callback, folder_id, page)
        return

    if action == "back":
        await _open_folder(callback, _parent_folder_id(folder_id), 0)
        return


@router.message(FileVaultStates.waiting_folder_create)
async def process_folder_create(message: Message, state: FSMContext) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass

    name = _sanitize_folder_name((message.text or "").strip())
    if not name:
        await message.answer("Название папки не должно быть пустым.")
        return

    data = await state.get_data()
    parent_id = _validate_folder_id(data.get("parent_id"))
    page = int(data.get("page", 0) or 0)

    try:
        create_folder(parent_id, name)
    except Exception as error:
        await message.answer(f"Не удалось создать папку: {error}")
        return

    await state.clear()
    await message.answer("Папка создана.")
    await _open_folder_from_message(message, parent_id, page)


@router.message(FileVaultStates.waiting_file_rename)
async def process_file_rename(message: Message, state: FSMContext) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass

    new_name = _sanitize_filename((message.text or "").strip())
    if not new_name:
        await message.answer("Имя файла не должно быть пустым.")
        return

    data = await state.get_data()
    file_id = str(data.get("file_id", ""))
    folder_id = _validate_folder_id(data.get("folder_id"))
    page = int(data.get("page", 0) or 0)

    try:
        rename_file(file_id, new_name)
    except Exception as error:
        await message.answer(f"Не удалось переименовать файл: {error}")
        return

    await state.clear()
    await message.answer("Файл переименован.")
    await _open_folder_from_message(message, folder_id, page)


@router.message(FileVaultStates.waiting_upload)
async def process_upload(message: Message, state: FSMContext) -> None:
    try:
        save_incoming_update(_synthetic_update(message))
    except Exception:
        pass

    data = await state.get_data()
    folder_id = _validate_folder_id(data.get("folder_id"))
    page = int(data.get("page", 0) or 0)

    file_obj = None
    filename = None
    content_type = None

    if message.document:
        file_obj = message.document
        filename = message.document.file_name or f"file_{message.message_id}"
        content_type = message.document.mime_type
    elif message.photo:
        file_obj = message.photo[-1]
        filename = f"photo_{message.message_id}.jpg"
        content_type = "image/jpeg"

    if file_obj is None:
        await message.answer("Нужен файл, отправленный как документ или фото.")
        return

    try:
        raw = await message.bot.download(file_obj)
        content = raw.getvalue()
    except Exception as error:
        await message.answer(f"Не удалось скачать файл из Telegram: {error}")
        return

    if not content:
        await message.answer("Пустой файл.")
        return

    try:
        from ..filevault_store import save_uploaded_blob
        save_uploaded_blob(
            original_name=filename or f"file_{message.message_id}",
            content=content,
            content_type=content_type,
            folder_id=folder_id,
        )
    except Exception as error:
        await message.answer(f"Не удалось сохранить файл: {error}")
        return

    await state.clear()
    await message.answer("Файл сохранён.")
    await _open_folder_from_message(message, folder_id, page)


async def _open_folder_from_message(message: Message, folder_id: str | None, page: int = 0) -> None:
    text, markup = _render_folder_markup(folder_id, page)
    await message.answer(text, reply_markup=markup)
