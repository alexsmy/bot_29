from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from uuid import uuid4

from routers.filevault_api import (
    UPLOAD_DIR,
    _blob_path,
    _compute_folder_metrics,
    _delete_files_by_ids,
    _ensure_folder_exists,
    _folder_children_map,
    _folder_index,
    _folder_path_label,
    _folder_tree_payload,
    _json_write,
    _load_all_file_meta,
    _load_folders,
    _load_meta,
    _lookup_folder,
    _meta_path,
    _now_iso,
    _remove_folder,
    _sanitize_filename,
    _sanitize_folder_name,
    _save_folders,
    _to_client_record,
    _validate_file_id,
    _validate_folder_id,
    _validate_folder_name,
)
from routers.filevault_api import _build_public_url  # type: ignore[attr-defined]


def _disk_free_label() -> str:
    stats = os.statvfs(str(UPLOAD_DIR))
    disk_free = stats.f_frsize * stats.f_bavail
    return _format_bytes(disk_free)


def _format_bytes(value: int | float) -> str:
    size = float(value or 0)
    units = ["Б", "КБ", "МБ", "ГБ", "ТБ"]
    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "Б":
                return f"{int(size)} {unit}"
            return f"{size:.1f} {unit}".replace(".0 ", " ")
        size /= 1024
    return f"{size:.1f} ТБ"


def _folder_payload(folder_id: str | None) -> dict[str, Any]:
    folders = _load_folders()
    files = _load_all_file_meta()
    metrics, _ = _compute_folder_metrics(files, folders)

    if folder_id is None:
        node = {
            "folder_id": None,
            "name": "Корень",
            "parent_id": None,
            "path": "Корень хранилища",
            "file_count": metrics.get(None, {}).get("file_count", 0),
            "size_bytes": metrics.get(None, {}).get("size_bytes", 0),
            "has_children": bool(_folder_tree_payload(folders, metrics)),
            "created_at": None,
            "updated_at": None,
            "children": _folder_tree_payload(folders, metrics),
        }
        return node

    _lookup_folder(folder_id)
    index = _folder_index(folders)
    folder = index[folder_id]
    children_map = _folder_children_map(folders)
    direct_files = [meta for meta in files if meta.get("folder_id") == folder_id]

    return {
        "folder_id": folder_id,
        "name": folder["name"],
        "parent_id": folder.get("parent_id"),
        "path": _folder_path_label(folder_id, folders),
        "file_count": metrics.get(folder_id, {}).get("file_count", 0),
        "size_bytes": metrics.get(folder_id, {}).get("size_bytes", 0),
        "has_children": bool(children_map.get(folder_id)),
        "created_at": folder.get("created_at"),
        "updated_at": folder.get("updated_at"),
        "children": children_map.get(folder_id, []),
        "files": [_to_client_record(meta, None, folders) for meta in direct_files],
    }


def get_dashboard() -> dict[str, Any]:
    files = _load_all_file_meta()
    folders = _load_folders()
    total_size = sum(int(item.get("size_bytes", 0) or 0) for item in files)
    stats = os.statvfs(str(UPLOAD_DIR))
    disk_total = stats.f_frsize * stats.f_blocks
    disk_free = stats.f_frsize * stats.f_bavail
    disk_used = disk_total - disk_free
    disk_used_percent = round((disk_used / disk_total * 100) if disk_total else 0, 2)
    return {
        "files_count": len(files),
        "folders_count": len(folders),
        "total_size_bytes": total_size,
        "disk_total_bytes": disk_total,
        "disk_free_bytes": disk_free,
        "disk_free_label": _format_bytes(disk_free),
        "disk_used_bytes": disk_used,
        "disk_used_percent": disk_used_percent,
    }


def list_folder(folder_id: str | None) -> dict[str, Any]:
    folder_id = _validate_folder_id(folder_id)
    payload = _folder_payload(folder_id)
    folders = _load_folders()
    metrics, _ = _compute_folder_metrics(_load_all_file_meta(), folders)

    children_map = _folder_children_map(folders)
    child_folders = children_map.get(folder_id, []) if folder_id is not None else children_map.get(None, [])
    files = [meta for meta in _load_all_file_meta() if meta.get("folder_id") == folder_id]

    return {
        "folder": payload,
        "folders": child_folders,
        "files": [_to_client_record(meta, None, folders) for meta in files],
        "path_label": payload["path"],
        "files_count": metrics.get(folder_id, {}).get("file_count", 0),
        "size_bytes": metrics.get(folder_id, {}).get("size_bytes", 0),
    }


def create_folder(parent_id: str | None, name: str) -> dict[str, Any]:
    parent_id = _validate_folder_id(parent_id)
    folders = _load_folders()
    _ensure_folder_exists(parent_id, folders)
    clean_name = _validate_folder_name(_sanitize_folder_name(name))
    sibling_names = {item["name"].casefold() for item in folders if item.get("parent_id") == parent_id}
    if clean_name.casefold() in sibling_names:
        raise ValueError("Папка с таким именем уже существует")

    folder = {
        "folder_id": f"fld_{uuid4().hex}",
        "name": clean_name,
        "parent_id": parent_id,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    folders.append(folder)
    _save_folders(folders)

    files = _load_all_file_meta()
    metrics, _ = _compute_folder_metrics(files, folders)
    return {
        "folder_id": folder["folder_id"],
        "name": folder["name"],
        "parent_id": folder.get("parent_id"),
        "path": _folder_path_label(folder["folder_id"], folders),
        "file_count": metrics.get(folder["folder_id"], {}).get("file_count", 0),
        "size_bytes": metrics.get(folder["folder_id"], {}).get("size_bytes", 0),
        "has_children": False,
        "created_at": folder.get("created_at"),
        "updated_at": folder.get("updated_at"),
    }


def rename_folder(folder_id: str, new_name: str) -> dict[str, Any]:
    folder_id = _validate_folder_id(folder_id)
    folders = _load_folders()
    index = _folder_index(folders)
    folder = index.get(folder_id)
    if not folder:
        raise ValueError("Папка не найдена")

    clean_name = _validate_folder_name(_sanitize_folder_name(new_name))
    sibling_names = {item["name"].casefold() for item in folders if item.get("parent_id") == folder.get("parent_id") and item["folder_id"] != folder_id}
    if clean_name.casefold() in sibling_names:
        raise ValueError("Папка с таким именем уже существует")

    folder["name"] = clean_name
    folder["updated_at"] = _now_iso()
    _save_folders(folders)

    files = _load_all_file_meta()
    metrics, _ = _compute_folder_metrics(files, folders)
    return {
        "folder_id": folder["folder_id"],
        "name": folder["name"],
        "parent_id": folder.get("parent_id"),
        "path": _folder_path_label(folder["folder_id"], folders),
        "file_count": metrics.get(folder["folder_id"], {}).get("file_count", 0),
        "size_bytes": metrics.get(folder["folder_id"], {}).get("size_bytes", 0),
        "has_children": bool(_folder_children_map(folders).get(folder_id)),
        "created_at": folder.get("created_at"),
        "updated_at": folder.get("updated_at"),
    }


def delete_folder(folder_id: str) -> int:
    folder_id = _validate_folder_id(folder_id)
    return _remove_folder(folder_id)


def rename_file(file_id: str, new_name: str) -> dict[str, Any]:
    file_id = _validate_file_id(file_id)
    meta = _load_meta(file_id)
    folders = _load_folders()
    clean_name = _sanitize_filename(new_name)
    if not clean_name:
        raise ValueError("Название файла не может быть пустым")
    meta["original_name"] = clean_name
    meta["updated_at"] = _now_iso()
    _json_write(_meta_path(file_id), meta)
    return _to_client_record(meta, None, folders)


def delete_file(file_id: str) -> int:
    file_id = _validate_file_id(file_id)
    return _delete_files_by_ids([file_id])


def get_file_info(file_id: str) -> dict[str, Any]:
    file_id = _validate_file_id(file_id)
    meta = _load_meta(file_id)
    folders = _load_folders()
    return _to_client_record(meta, None, folders)


def save_uploaded_blob(
    *,
    original_name: str,
    content: bytes,
    content_type: str | None,
    folder_id: str | None,
) -> dict[str, Any]:
    folder_id = _validate_folder_id(folder_id)
    folders = _load_folders()
    _ensure_folder_exists(folder_id, folders)

    filename = _sanitize_filename(original_name)
    if not filename:
        filename = "file"

    file_id = uuid4().hex
    blob_path = _blob_path(file_id)
    meta_path = _meta_path(file_id)

    blob_path.write_bytes(content)
    meta = {
        "file_id": file_id,
        "original_name": filename,
        "content_type": content_type or "application/octet-stream",
        "size_bytes": len(content),
        "uploaded_at": _now_iso(),
        "folder_id": folder_id,
    }
    _json_write(meta_path, meta)
    return _to_client_record(meta, None, folders)


def get_public_file_url(file_id: str) -> str:
    return _build_public_url(_validate_file_id(file_id), None)
