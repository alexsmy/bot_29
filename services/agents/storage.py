from __future__ import annotations

import json
import mimetypes
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


FILEVAULT_ROOT = Path("data/filevault_uploads")
AGENTS_ROOT = Path("data/agents")
INBOX_ROOT = AGENTS_ROOT / "inbox"
OUTBOX_ROOT = AGENTS_ROOT / "outbox"
ARCHIVE_ROOT = AGENTS_ROOT / "archive"
DYNAMIC_AGENTS_ROOT = AGENTS_ROOT / "dynamic"

for directory in (FILEVAULT_ROOT, AGENTS_ROOT, INBOX_ROOT, OUTBOX_ROOT, ARCHIVE_ROOT, DYNAMIC_AGENTS_ROOT):
    directory.mkdir(parents=True, exist_ok=True)


@dataclass(slots=True)
class StoredArtifact:
    file_id: str
    original_name: str
    blob_path: str
    meta_path: str
    public_name: str
    content_type: str
    size_bytes: int
    uploaded_at: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_write(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _sanitize_filename(filename: str) -> str:
    cleaned = os.path.basename(filename or "").strip()
    cleaned = re.sub(r"[\r\n\t\x00]", "_", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or "file.json"


def _guess_content_type(filename: str, fallback: str = "application/json") -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or fallback


def _meta_path(file_id: str) -> Path:
    return FILEVAULT_ROOT / f"{file_id}.json"


def _blob_path(file_id: str) -> Path:
    return FILEVAULT_ROOT / f"{file_id}.bin"


def store_json_as_filevault_record(
    payload: dict[str, Any],
    *,
    original_name: str,
    folder_id: str | None = None,
) -> StoredArtifact:
    file_id = uuid4().hex
    sanitized_name = _sanitize_filename(original_name)
    blob_path = _blob_path(file_id)
    meta_path = _meta_path(file_id)

    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    blob_path.write_bytes(body)

    meta = {
        "file_id": file_id,
        "original_name": sanitized_name,
        "content_type": _guess_content_type(sanitized_name),
        "size_bytes": len(body),
        "uploaded_at": utc_now_iso(),
        "folder_id": folder_id,
    }
    _json_write(meta_path, meta)

    return StoredArtifact(
        file_id=file_id,
        original_name=sanitized_name,
        blob_path=str(blob_path),
        meta_path=str(meta_path),
        public_name=sanitized_name,
        content_type=meta["content_type"],
        size_bytes=len(body),
        uploaded_at=meta["uploaded_at"],
    )


# --- Сохранение ответов и кода агентов в FileVault (папка Agents) ---
# Нужно для history-эндпоинтов (/api/agents/responses)
# и для сохранения кода загруженных агентов.

_AGENT_FILEVAULT_FOLDER_ID: str | None = None
FOLDERS_META = FILEVAULT_ROOT / "_folders.json"


def _ensure_agent_filevault_folder() -> str:
    """Создать папку 'Agents' в FileVault, если её нет. Вернуть folder_id."""
    global _AGENT_FILEVAULT_FOLDER_ID

    if _AGENT_FILEVAULT_FOLDER_ID:
        return _AGENT_FILEVAULT_FOLDER_ID

    try:
        folders = json.loads(FOLDERS_META.read_text(encoding="utf-8")) if FOLDERS_META.exists() else []
    except Exception:
        folders = []
    if not isinstance(folders, list):
        folders = []

    for f in folders:
        if isinstance(f, dict) and f.get("name") == "Agents" and f.get("parent_id") is None:
            _AGENT_FILEVAULT_FOLDER_ID = f["folder_id"]
            return _AGENT_FILEVAULT_FOLDER_ID

    folder_id = f"fld_{uuid4().hex}"
    now = utc_now_iso()
    folders.append({
        "folder_id": folder_id,
        "name": "Agents",
        "parent_id": None,
        "created_at": now,
        "updated_at": now,
    })
    _json_write(FOLDERS_META, folders)
    _AGENT_FILEVAULT_FOLDER_ID = folder_id
    return folder_id


def save_agent_response_to_filevault(
    agent_name: str,
    request_id: str,
    payload: dict[str, Any],
) -> StoredArtifact:
    """
    Сохранить ответ агента в FileVault (папка Agents).

    Используется для истории ответов (/api/agents/responses).
    """
    folder_id = _ensure_agent_filevault_folder()
    file_name = f"agent-response-{agent_name}-{request_id}.json"
    return store_json_as_filevault_record(payload, original_name=file_name, folder_id=folder_id)


def save_agent_code_to_filevault(
    agent_name: str,
    code: str,
) -> StoredArtifact:
    """
    Сохранить код загруженного агента в FileVault (папка Agents).

    Позволяет просматривать код агентов через веб-интерфейс FileVault.
    """
    folder_id = _ensure_agent_filevault_folder()
    file_name = f"agent-code-{agent_name}.py"
    file_id = uuid4().hex
    sanitized_name = _sanitize_filename(file_name)
    blob_path = _blob_path(file_id)
    meta_path = _meta_path(file_id)

    body = code.encode("utf-8")
    blob_path.write_bytes(body)

    meta = {
        "file_id": file_id,
        "original_name": sanitized_name,
        "content_type": "text/x-python",
        "size_bytes": len(body),
        "uploaded_at": utc_now_iso(),
        "folder_id": folder_id,
    }
    _json_write(meta_path, meta)

    return StoredArtifact(
        file_id=file_id,
        original_name=sanitized_name,
        blob_path=str(blob_path),
        meta_path=str(meta_path),
        public_name=sanitized_name,
        content_type=meta["content_type"],
        size_bytes=len(body),
        uploaded_at=meta["uploaded_at"],
    )


def store_agent_job(job_id: str, payload: dict[str, Any]) -> str:
    path = INBOX_ROOT / f"{job_id}.json"
    _json_write(path, payload)
    return str(path)


def store_agent_outbox(job_id: str, payload: dict[str, Any]) -> str:
    path = OUTBOX_ROOT / f"{job_id}.json"
    _json_write(path, payload)
    return str(path)


def archive_agent_payload(job_id: str, payload: dict[str, Any]) -> str:
    path = ARCHIVE_ROOT / f"{job_id}.json"
    _json_write(path, payload)
    return str(path)
