import json
import mimetypes
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter(prefix="/api/filevault", tags=["filevault"])
public_router = APIRouter(tags=["filevault-public"])

UPLOAD_DIR = Path("data/filevault_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024


def _meta_path(file_id: str) -> Path:
    return UPLOAD_DIR / f"{file_id}.json"


def _blob_path(file_id: str) -> Path:
    return UPLOAD_DIR / f"{file_id}.bin"


def _sanitize_filename(filename: str) -> str:
    cleaned = os.path.basename(filename or "").strip()
    cleaned = re.sub(r"[\r\n\t\x00]", "_", cleaned)
    return cleaned or "file"


def _guess_content_type(filename: str, fallback: str = "application/octet-stream") -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or fallback


def _load_meta(file_id: str) -> dict:
    meta_path = _meta_path(file_id)
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")

    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Ошибка чтения метаданных файла")


def _build_public_url(file_id: str, request: Request | None = None) -> str:
    public_path = f"/files/open/{quote(file_id)}"
    if request is None:
        return public_path
    return str(request.base_url).rstrip("/") + public_path


def _to_client_record(meta: dict, request: Request | None = None) -> dict:
    file_id = meta["file_id"]
    blob_path = _blob_path(file_id)
    stat = blob_path.stat() if blob_path.exists() else None

    return {
        "file_id": file_id,
        "original_name": meta.get("original_name", file_id),
        "storage_name": blob_path.name,
        "content_type": meta.get("content_type", "application/octet-stream"),
        "size_bytes": stat.st_size if stat else int(meta.get("size_bytes", 0)),
        "uploaded_at": meta.get("uploaded_at"),
        "public_url": _build_public_url(file_id, request),
    }


@router.get("/files")
async def list_files(request: Request):
    files = []

    for meta_path in sorted(UPLOAD_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            file_id = meta.get("file_id")
            if not file_id:
                continue
            blob = _blob_path(file_id)
            if not blob.exists():
                continue
            files.append(_to_client_record(meta, request))
        except Exception:
            continue

    return JSONResponse({"success": True, "files": files})


@router.post("/upload")
async def upload_files(request: Request, files: List[UploadFile] = File(...)):
    if not files:
        return JSONResponse({"success": False, "error": "Файлы не переданы"}, status_code=400)

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
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        created.append(_to_client_record(meta, request))

    if not created:
        return JSONResponse({"success": False, "error": "Не удалось сохранить ни одного файла"}, status_code=400)

    return JSONResponse({"success": True, "files": created})


@router.get("/files/info/{file_id}")
async def get_file_info(file_id: str, request: Request):
    if not file_id or not re.fullmatch(r"[a-f0-9]{32}", file_id):
        raise HTTPException(status_code=400, detail="Неверный идентификатор файла")

    meta = _load_meta(file_id)
    return JSONResponse({"success": True, "file": _to_client_record(meta, request)})


@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    if not file_id or not re.fullmatch(r"[a-f0-9]{32}", file_id):
        raise HTTPException(status_code=400, detail="Неверный идентификатор файла")

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


@public_router.get("/files/open/{file_id}")
async def open_file(file_id: str):
    if not file_id or not re.fullmatch(r"[a-f0-9]{32}", file_id):
        raise HTTPException(status_code=400, detail="Неверный идентификатор файла")

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
