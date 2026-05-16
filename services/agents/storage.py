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

for directory in (FILEVAULT_ROOT, AGENTS_ROOT, INBOX_ROOT, OUTBOX_ROOT, ARCHIVE_ROOT):
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
