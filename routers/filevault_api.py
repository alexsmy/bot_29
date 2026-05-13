import json
import mimetypes
import os
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Body, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter(prefix="/api/filevault", tags=["filevault"])
public_router = APIRouter(tags=["filevault-public"])

UPLOAD_DIR = Path("data/filevault_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

FILES_META_GLOB = "*.json"
FOLDERS_META_PATH = UPLOAD_DIR / "_folders.json"
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
FOLDER_ID_RE = re.compile(r"^fld_[a-f0-9]{32}$")
FILE_ID_RE = re.compile(r"^[a-f0-9]{32}$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_read(path: Path, fallback: Any):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def _json_write(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _meta_path(file_id: str) -> Path:
    return UPLOAD_DIR / f"{file_id}.json"


def _blob_path(file_id: str) -> Path:
    return UPLOAD_DIR / f"{file_id}.bin"


def _sanitize_filename(filename: str) -> str:
    cleaned = os.path.basename(filename or "").strip()
    cleaned = re.sub(r"[\r\n\t\x00]", "_", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or "file"


def _sanitize_folder_name(name: str) -> str:
    cleaned = re.sub(r"[\r\n\t\x00]", " ", str(name or "")).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:96]


def _guess_content_type(filename: str, fallback: str = "application/octet-stream") -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or fallback


def _load_meta(file_id: str) -> dict:
    meta_path = _meta_path(file_id)
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")

    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("invalid meta payload")
        return payload
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Ошибка чтения метаданных файла")


def _load_all_file_meta() -> list[dict]:
    records: list[dict] = []
    for meta_path in sorted(UPLOAD_DIR.glob(FILES_META_GLOB), key=lambda item: item.stat().st_mtime, reverse=True):
        if meta_path.name == FOLDERS_META_PATH.name:
            continue
        try:
            payload = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue
        file_id = payload.get("file_id")
        if not file_id or not FILE_ID_RE.fullmatch(str(file_id)):
            continue
        if not _blob_path(file_id).exists():
            continue
        records.append(payload)
    return records


def _load_folders() -> list[dict]:
    payload = _json_read(FOLDERS_META_PATH, [])
    if not isinstance(payload, list):
        return []

    folders: list[dict] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        folder_id = str(item.get("folder_id", ""))
        if not FOLDER_ID_RE.fullmatch(folder_id):
            continue
        folders.append(
            {
                "folder_id": folder_id,
                "name": _sanitize_folder_name(item.get("name", "")) or "Папка",
                "parent_id": item.get("parent_id") if item.get("parent_id") in {None, ""} or FOLDER_ID_RE.fullmatch(str(item.get("parent_id"))) else None,
                "created_at": item.get("created_at") or _now_iso(),
                "updated_at": item.get("updated_at") or item.get("created_at") or _now_iso(),
            }
        )
    return folders


def _save_folders(folders: list[dict]) -> None:
    _json_write(FOLDERS_META_PATH, folders)


def _folder_index(folders: list[dict] | None = None) -> dict[str, dict]:
    folders = folders if folders is not None else _load_folders()
    return {folder["folder_id"]: folder for folder in folders}


def _folder_children_map(folders: list[dict]) -> dict[str | None, list[dict]]:
    children: dict[str | None, list[dict]] = defaultdict(list)
    for folder in folders:
        parent_id = folder.get("parent_id")
        children[parent_id].append(folder)
    for items in children.values():
        items.sort(key=lambda item: (item["name"].casefold(), item["created_at"]))
    return children


def _validate_folder_id(folder_id: str | None) -> str | None:
    if folder_id in {None, "", "null"}:
        return None
    folder_id = str(folder_id)
    if not FOLDER_ID_RE.fullmatch(folder_id):
        raise HTTPException(status_code=400, detail="Неверный идентификатор папки")
    return folder_id


def _validate_file_id(file_id: str) -> str:
    if not file_id or not FILE_ID_RE.fullmatch(file_id):
        raise HTTPException(status_code=400, detail="Неверный идентификатор файла")
    return file_id


def _ensure_folder_exists(folder_id: str | None, folders: list[dict] | None = None) -> None:
    if folder_id is None:
        return
    index = _folder_index(folders)
    if folder_id not in index:
        raise HTTPException(status_code=404, detail="Папка не найдена")


def _folder_path(folder_id: str | None, folders: list[dict] | None = None) -> list[str]:
    if folder_id is None:
        return ["Корень хранилища"]

    index = _folder_index(folders)
    chain: list[str] = []
    current = index.get(folder_id)
    guard = 0

    while current:
        chain.append(current["name"])
        parent_id = current.get("parent_id")
        if parent_id is None:
            break
        current = index.get(parent_id)
        guard += 1
        if guard > 256:
            break

    return ["Корень", *reversed(chain)]


def _folder_path_label(folder_id: str | None, folders: list[dict] | None = None) -> str:
    return " / ".join(_folder_path(folder_id, folders))


def _build_public_url(file_id: str, request: Request | None = None) -> str:
    public_path = f"/files/open/{quote(file_id)}"
    if request is None:
        return public_path
    return str(request.base_url).rstrip("/") + public_path


def _compute_folder_metrics(files: list[dict], folders: list[dict]) -> tuple[dict[str | None, dict[str, int]], dict[str, tuple[int, int]]]:
    files_by_folder: dict[str | None, list[dict]] = defaultdict(list)
    for file_record in files:
        files_by_folder[file_record.get("folder_id")].append(file_record)

    children_map = defaultdict(list)
    for folder in folders:
        children_map[folder.get("parent_id")].append(folder["folder_id"])

    memo: dict[str | None, tuple[int, int]] = {}

    def aggregate(folder_id: str | None) -> tuple[int, int]:
        if folder_id in memo:
            return memo[folder_id]

        direct_files = files_by_folder.get(folder_id, [])
        total_count = len(direct_files)
        total_size = sum(int(item.get("size_bytes", 0) or 0) for item in direct_files)

        for child_id in children_map.get(folder_id, []):
            child_count, child_size = aggregate(child_id)
            total_count += child_count
            total_size += child_size

        memo[folder_id] = (total_count, total_size)
        return memo[folder_id]

    folder_metrics: dict[str | None, dict[str, int]] = {}
    for folder in folders:
        count, size = aggregate(folder["folder_id"])
        folder_metrics[folder["folder_id"]] = {"file_count": count, "size_bytes": size}

    root_count, root_size = aggregate(None)
    folder_metrics[None] = {"file_count": root_count, "size_bytes": root_size}
    return folder_metrics, memo


def _folder_tree_payload(folders: list[dict], metrics: dict[str | None, dict[str, int]]) -> list[dict]:
    index = _folder_index(folders)
    children_map = _folder_children_map(folders)

    def build_node(folder: dict, level: int) -> dict:
        folder_id = folder["folder_id"]
        path_label = _folder_path_label(folder_id, folders)
        child_nodes = children_map.get(folder_id, [])
        return {
            "folder_id": folder_id,
            "name": folder["name"],
            "parent_id": folder.get("parent_id"),
            "level": level,
            "path": path_label,
            "file_count": metrics.get(folder_id, {}).get("file_count", 0),
            "size_bytes": metrics.get(folder_id, {}).get("size_bytes", 0),
            "has_children": bool(child_nodes),
            "created_at": folder.get("created_at"),
            "updated_at": folder.get("updated_at"),
            "children": [build_node(index[child_id], level + 1) for child_id in child_nodes],
        }

    roots = [folder for folder in folders if folder.get("parent_id") is None]
    roots.sort(key=lambda item: (item["name"].casefold(), item["created_at"]))
    return [build_node(folder, 0) for folder in roots]


def _folder_name(folder_id: str | None, folders: list[dict]) -> str:
    if folder_id is None:
        return "Корень"
    return _folder_index(folders).get(folder_id, {}).get("name", "Папка")


def _to_client_record(meta: dict, request: Request | None = None, folders: list[dict] | None = None) -> dict:
    folders = folders if folders is not None else _load_folders()
    file_id = meta["file_id"]
    blob_path = _blob_path(file_id)
    stat = blob_path.stat() if blob_path.exists() else None
    folder_id = meta.get("folder_id")
    folder_id = folder_id if folder_id in {None, ""} or FOLDER_ID_RE.fullmatch(str(folder_id)) else None

    return {
        "file_id": file_id,
        "original_name": meta.get("original_name", file_id),
        "storage_name": blob_path.name,
        "content_type": meta.get("content_type", "application/octet-stream"),
        "size_bytes": stat.st_size if stat else int(meta.get("size_bytes", 0) or 0),
        "uploaded_at": meta.get("uploaded_at"),
        "folder_id": folder_id,
        "folder_name": _folder_name(folder_id, folders),
        "folder_path": _folder_path_label(folder_id, folders),
        "public_url": _build_public_url(file_id, request),
    }


def _list_client_files(request: Request | None = None) -> list[dict]:
    folders = _load_folders()
    return [_to_client_record(meta, request, folders) for meta in _load_all_file_meta()]


def _list_client_folders() -> list[dict]:
    folders = _load_folders()
    files = _load_all_file_meta()
    metrics, _ = _compute_folder_metrics(files, folders)
    tree = _folder_tree_payload(folders, metrics)

    flattened: list[dict] = []

    def walk(nodes: list[dict]) -> None:
        for node in nodes:
            flattened.append(node)
            walk(node.get("children", []))

    walk(tree)
    flattened.insert(
        0,
        {
            "folder_id": None,
            "name": "Корень",
            "parent_id": None,
            "level": 0,
            "path": "Корень хранилища",
            "file_count": metrics.get(None, {}).get("file_count", 0),
            "size_bytes": metrics.get(None, {}).get("size_bytes", 0),
            "has_children": bool(tree),
            "created_at": None,
            "updated_at": None,
            "children": tree,
        },
    )
    return flattened


def _lookup_folder(folder_id: str) -> dict:
    folders = _load_folders()
    index = _folder_index(folders)
    folder = index.get(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Папка не найдена")
    return folder


def _find_folder_siblings(folder: dict, folders: list[dict]) -> list[dict]:
    siblings = [
        item
        for item in folders
        if item.get("parent_id") == folder.get("parent_id") and item["folder_id"] != folder["folder_id"]
    ]
    return siblings


def _folder_descendant_ids(folder_id: str, folders: list[dict] | None = None) -> list[str]:
    folders = folders if folders is not None else _load_folders()
    children_map = defaultdict(list)
    for folder in folders:
        children_map[folder.get("parent_id")].append(folder["folder_id"])

    collected: list[str] = []

    def walk(current_id: str) -> None:
        for child_id in children_map.get(current_id, []):
            collected.append(child_id)
            walk(child_id)

    walk(folder_id)
    return collected


def _delete_files_by_ids(file_ids: list[str]) -> int:
    removed = 0
    for file_id in file_ids:
        meta_path = _meta_path(file_id)
        blob_path = _blob_path(file_id)
        existed = False
        if blob_path.exists():
            blob_path.unlink()
            existed = True
        if meta_path.exists():
            meta_path.unlink()
            existed = True
        if existed:
            removed += 1
    return removed


def _remove_folder(folder_id: str) -> int:
    folders = _load_folders()
    folder_ids = [folder_id, *_folder_descendant_ids(folder_id, folders)]
    folder_set = set(folder_ids)

    files_to_delete = []
    for meta in _load_all_file_meta():
        file_folder = meta.get("folder_id")
        if file_folder in folder_set:
            files_to_delete.append(meta["file_id"])

    _delete_files_by_ids(files_to_delete)

    remaining_folders = [folder for folder in folders if folder["folder_id"] not in folder_set]
    _save_folders(remaining_folders)
    return len(folder_set)


def _validate_folder_name(name: str) -> str:
    cleaned = _sanitize_folder_name(name)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Название папки не может быть пустым")
    if len(cleaned) > 96:
        raise HTTPException(status_code=400, detail="Название папки слишком длинное")
    return cleaned


@router.get("/dashboard")
async def get_dashboard():
    files = _load_all_file_meta()
    folders = _load_folders()

    total_size = sum(int(item.get("size_bytes", 0) or 0) for item in files)
    stats = os.statvfs(str(UPLOAD_DIR))
    disk_total = stats.f_frsize * stats.f_blocks
    disk_free = stats.f_frsize * stats.f_bavail
    disk_used = disk_total - disk_free
    disk_used_percent = round((disk_used / disk_total * 100) if disk_total else 0, 2)

    return JSONResponse(
        {
            "success": True,
            "dashboard": {
                "files_count": len(files),
                "folders_count": len(folders),
                "total_size_bytes": total_size,
                "disk_total_bytes": disk_total,
                "disk_free_bytes": disk_free,
                "disk_used_bytes": disk_used,
                "disk_used_percent": disk_used_percent,
                "root_files_count": sum(1 for item in files if item.get("folder_id") in {None, ""}),
            },
        }
    )


@router.get("/files")
async def list_files(request: Request):
    files = _list_client_files(request)
    return JSONResponse({"success": True, "files": files})


@router.post("/upload")
async def upload_files(request: Request, files: list[UploadFile] = File(...), folder_id: str | None = Form(None)):
    if not files:
        return JSONResponse({"success": False, "error": "Файлы не переданы"}, status_code=400)

    folder_id = _validate_folder_id(folder_id)
    folders = _load_folders()
    _ensure_folder_exists(folder_id, folders)

    created = []

    for uploaded_file in files:
        filename = _sanitize_filename(uploaded_file.filename)
        file_id = uuid4().hex
        blob_path = _blob_path(file_id)
        meta_path = _meta_path(file_id)

        content = await uploaded_file.read()
        if not content:
            continue
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=413, detail=f"Файл '{filename}' слишком большой")

        content_type = uploaded_file.content_type or _guess_content_type(filename)

        blob_path.write_bytes(content)
        meta = {
            "file_id": file_id,
            "original_name": filename,
            "content_type": content_type,
            "size_bytes": len(content),
            "uploaded_at": _now_iso(),
            "folder_id": folder_id,
        }
        _json_write(meta_path, meta)
        created.append(_to_client_record(meta, request, folders))

    if not created:
        return JSONResponse({"success": False, "error": "Не удалось сохранить ни одного файла"}, status_code=400)

    return JSONResponse({"success": True, "files": created})


@router.patch("/files/{file_id}")
async def update_file(file_id: str, request: Request, payload: dict = Body(...)):
    file_id = _validate_file_id(file_id)
    meta = _load_meta(file_id)
    folders = _load_folders()

    updated = False

    if "original_name" in payload:
        new_name = _sanitize_filename(str(payload.get("original_name", "")))
        if not new_name:
            raise HTTPException(status_code=400, detail="Название файла не может быть пустым")
        meta["original_name"] = new_name
        updated = True

    if "folder_id" in payload:
        folder_id = _validate_folder_id(payload.get("folder_id"))
        _ensure_folder_exists(folder_id, folders)
        meta["folder_id"] = folder_id
        updated = True

    if not updated:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")

    meta["updated_at"] = _now_iso()
    _json_write(_meta_path(file_id), meta)
    return JSONResponse({"success": True, "file": _to_client_record(meta, request, folders)})


@router.post("/files/batch/move")
async def move_files_batch(request: Request, payload: dict = Body(...)):
    file_ids = payload.get("file_ids") or []
    folder_id = _validate_folder_id(payload.get("folder_id"))
    folders = _load_folders()
    _ensure_folder_exists(folder_id, folders)

    if not isinstance(file_ids, list) or not file_ids:
        raise HTTPException(status_code=400, detail="Список файлов пуст")

    moved = []
    for raw_file_id in file_ids:
        file_id = _validate_file_id(str(raw_file_id))
        meta = _load_meta(file_id)
        meta["folder_id"] = folder_id
        meta["updated_at"] = _now_iso()
        _json_write(_meta_path(file_id), meta)
        moved.append(_to_client_record(meta, request, folders))

    return JSONResponse({"success": True, "files": moved})


@router.post("/files/batch/delete")
async def delete_files_batch(payload: dict = Body(...)):
    file_ids = payload.get("file_ids") or []
    if not isinstance(file_ids, list) or not file_ids:
        raise HTTPException(status_code=400, detail="Список файлов пуст")

    normalized = [_validate_file_id(str(file_id)) for file_id in file_ids]
    removed = _delete_files_by_ids(normalized)

    return JSONResponse({"success": True, "deleted": removed})


@router.get("/files/info/{file_id}")
async def get_file_info(file_id: str, request: Request):
    file_id = _validate_file_id(file_id)
    meta = _load_meta(file_id)
    folders = _load_folders()
    return JSONResponse({"success": True, "file": _to_client_record(meta, request, folders)})


@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    file_id = _validate_file_id(file_id)
    meta_path = _meta_path(file_id)
    blob_path = _blob_path(file_id)
    existed = False

    if blob_path.exists():
        blob_path.unlink()
        existed = True

    if meta_path.exists():
        meta_path.unlink()
        existed = True

    if not existed:
        raise HTTPException(status_code=404, detail="Файл не найден")

    return JSONResponse({"success": True})


@router.get("/folders")
async def list_folders():
    folders = _load_folders()
    files = _load_all_file_meta()
    metrics, _ = _compute_folder_metrics(files, folders)
    tree = _folder_tree_payload(folders, metrics)

    return JSONResponse(
        {
            "success": True,
            "folders": [
                {
                    "folder_id": None,
                    "name": "Корень",
                    "parent_id": None,
                    "level": 0,
                    "path": "Корень хранилища",
                    "file_count": metrics.get(None, {}).get("file_count", 0),
                    "size_bytes": metrics.get(None, {}).get("size_bytes", 0),
                    "has_children": bool(tree),
                    "created_at": None,
                    "updated_at": None,
                },
                *[item for item in _folder_tree_payload(folders, metrics)],
            ],
            "tree": tree,
        }
    )


@router.post("/folders")
async def create_folder(payload: dict = Body(...)):
    folders = _load_folders()
    name = _validate_folder_name(str(payload.get("name", "")))
    parent_id = _validate_folder_id(payload.get("parent_id"))
    _ensure_folder_exists(parent_id, folders)

    sibling_names = {item["name"].casefold() for item in folders if item.get("parent_id") == parent_id}
    if name.casefold() in sibling_names:
        raise HTTPException(status_code=409, detail="Папка с таким именем уже существует")

    folder = {
        "folder_id": f"fld_{uuid4().hex}",
        "name": name,
        "parent_id": parent_id,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    folders.append(folder)
    _save_folders(folders)

    files = _load_all_file_meta()
    metrics, _ = _compute_folder_metrics(files, folders)
    folder_payload = _folder_tree_payload(folders, metrics)
    index = _folder_index(folders)
    created = index[folder["folder_id"]]
    created_payload = {
        "folder_id": created["folder_id"],
        "name": created["name"],
        "parent_id": created.get("parent_id"),
        "level": 0 if created.get("parent_id") is None else 1,
        "path": _folder_path_label(created["folder_id"], folders),
        "file_count": metrics.get(created["folder_id"], {}).get("file_count", 0),
        "size_bytes": metrics.get(created["folder_id"], {}).get("size_bytes", 0),
        "has_children": False,
        "created_at": created.get("created_at"),
        "updated_at": created.get("updated_at"),
        "children": [],
    }

    return JSONResponse({"success": True, "folder": created_payload, "folders": [*folder_payload]})


@router.patch("/folders/{folder_id}")
async def rename_folder(folder_id: str, payload: dict = Body(...)):
    folder_id = _validate_folder_id(folder_id)
    folders = _load_folders()
    index = _folder_index(folders)
    folder = index.get(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Папка не найдена")

    name = _validate_folder_name(str(payload.get("name", "")))
    sibling_names = {item["name"].casefold() for item in folders if item.get("parent_id") == folder.get("parent_id") and item["folder_id"] != folder_id}
    if name.casefold() in sibling_names:
        raise HTTPException(status_code=409, detail="Папка с таким именем уже существует")

    folder["name"] = name
    folder["updated_at"] = _now_iso()
    _save_folders(folders)

    files = _load_all_file_meta()
    metrics, _ = _compute_folder_metrics(files, folders)
    return JSONResponse(
        {
            "success": True,
            "folder": {
                "folder_id": folder["folder_id"],
                "name": folder["name"],
                "parent_id": folder.get("parent_id"),
                "level": 0,
                "path": _folder_path_label(folder["folder_id"], folders),
                "file_count": metrics.get(folder["folder_id"], {}).get("file_count", 0),
                "size_bytes": metrics.get(folder["folder_id"], {}).get("size_bytes", 0),
                "has_children": bool(_folder_descendant_ids(folder["folder_id"], folders)),
                "created_at": folder.get("created_at"),
                "updated_at": folder.get("updated_at"),
                "children": [],
            },
        }
    )


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str):
    folder_id = _validate_folder_id(folder_id)
    folders = _load_folders()
    index = _folder_index(folders)
    if folder_id not in index:
        raise HTTPException(status_code=404, detail="Папка не найдена")

    removed_count = _remove_folder(folder_id)
    return JSONResponse({"success": True, "removed_folders": removed_count})


@router.get("/folders/{folder_id}/contents")
async def folder_contents(folder_id: str, request: Request):
    folder_id = _validate_folder_id(folder_id)
    if folder_id is not None:
        _lookup_folder(folder_id)

    files = _load_all_file_meta()
    folders = _load_folders()

    folder_files = [_to_client_record(meta, request, folders) for meta in files if meta.get("folder_id") == folder_id]
    return JSONResponse({"success": True, "files": folder_files})


@public_router.get("/files/open/{file_id}")
async def open_file(file_id: str):
    file_id = _validate_file_id(file_id)

    meta = _load_meta(file_id)
    blob_path = _blob_path(file_id)

    if not blob_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")

    original_name = meta.get("original_name", f"{file_id}.bin")
    content_type = meta.get("content_type") or _guess_content_type(original_name)
    inline_name = quote(original_name)

    return FileResponse(
        path=blob_path,
        media_type=content_type,
        filename=original_name,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{inline_name}"},
    )
