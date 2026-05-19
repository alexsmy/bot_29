"""
Telegram listener: polls getUpdates, stores incoming messages in data/telegram_inbox/.

Designed for duplex (two-way) communication:
  - User writes to Telegram bot
  - Listener captures the message
  - Stores as JSON in inbox/
  - AI reads via GET /api/telegram/inbox
  - AI responds via send_telegram_message MCP tool
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from utils.logger import log

INBOX_DIR = Path("data/telegram_inbox")
POLL_INTERVAL = 3.0  # seconds between polls
LONG_POLL_TIMEOUT = 20  # seconds for Telegram getUpdates long polling
TELEGRAM_API = "https://api.telegram.org"


def _get_bot_token() -> str:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        log("LISTENER", "TELEGRAM_BOT_TOKEN not set, listener disabled")
    return token


def _get_allowed_chat_id() -> str | None:
    return os.environ.get("TELEGRAM_CHAT_ID") or None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_inbox_dir():
    INBOX_DIR.mkdir(parents=True, exist_ok=True)


def _offset_path() -> Path:
    return INBOX_DIR / "_offset.txt"


def _read_offset() -> int:
    path = _offset_path()
    if path.exists():
        try:
            return int(path.read_text().strip())
        except (ValueError, OSError):
            pass
    return 0


def _save_offset(offset: int):
    _offset_path().write_text(str(offset))


def _message_path(update_id: int) -> Path:
    return INBOX_DIR / f"msg_{update_id}.json"


def _save_message(update: dict) -> dict | None:
    """Save a Telegram update to inbox if it's a message from the allowed chat."""
    update_id = update.get("update_id")
    if not update_id:
        return None

    # Extract message (handle various Telegram update types)
    msg = update.get("message") or update.get("edited_message") or {}
    if not msg:
        return None

    chat_id = str(msg.get("chat", {}).get("id", ""))
    allowed = _get_allowed_chat_id()
    if allowed and chat_id != allowed:
        return None

    # Build stored record
    record = {
        "update_id": update_id,
        "message_id": msg.get("message_id"),
        "chat_id": chat_id,
        "date": msg.get("date"),
        "received_at": _now_iso(),
        "acknowledged": False,
    }

    # Text
    record["text"] = msg.get("text") or msg.get("caption") or ""

    # Sender info
    fr = msg.get("from", {})
    if fr:
        record["from"] = {
            "id": fr.get("id"),
            "first_name": fr.get("first_name"),
            "last_name": fr.get("last_name"),
            "username": fr.get("username"),
        }

    # Media/file info
    for media_field in ("photo", "video", "audio", "voice", "document"):
        if media_field in msg:
            record["has_media"] = True
            record["media_type"] = media_field
            if media_field == "photo":
                # Telegram sends photo as array of sizes, last is largest
                sizes = msg["photo"]
                record["file_id"] = sizes[-1]["file_id"]
            else:
                record["file_id"] = msg[media_field].get("file_id", "")
            break

    # Save
    path = _message_path(update_id)
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return record


def save_incoming_update(update: dict) -> dict | None:
    """Public wrapper used by the aiogram bot to persist incoming updates."""
    return _save_message(update)


async def poll_once(client: httpx.AsyncClient, offset: int) -> list[dict]:
    """Fetch updates from Telegram and return newly saved records."""
    token = _get_bot_token()
    if not token:
        return []

    url = f"{TELEGRAM_API}/bot{token}/getUpdates"
    params = {
        "offset": offset,
        "timeout": LONG_POLL_TIMEOUT,
        "allowed_updates": ["message", "edited_message"],
    }

    try:
        resp = await client.get(url, params=params, timeout=LONG_POLL_TIMEOUT + 5)
        data = resp.json()
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        log("LISTENER", f"Poll error (expected): {e}")
        return []
    except Exception as e:
        log("LISTENER", f"Poll error: {e}", level=40)
        return []

    if not data.get("ok"):
        log("LISTENER", f"Telegram API error: {data.get('description', 'unknown')}", level=40)
        return []

    updates = data.get("result", [])
    if not updates:
        return []

    saved = []
    for update in updates:
        record = _save_message(update)
        if record:
            saved.append(record)

    # Advance offset past all processed updates
    max_id = max(u["update_id"] for u in updates)
    _save_offset(max_id + 1)

    return saved


async def listener_loop():
    """Main loop: poll Telegram for new messages indefinitely."""
    token = _get_bot_token()
    if not token:
        log("LISTENER", "Listener disabled: no TELEGRAM_BOT_TOKEN")
        return

    _ensure_inbox_dir()
    offset = _read_offset()
    log("LISTENER", f"Listener started, offset={offset}")

    async with httpx.AsyncClient() as client:
        while True:
            try:
                saved = await poll_once(client, offset)
                for record in saved:
                    text = record.get("text", "")[:80]
                    log("LISTENER", f"New message: {record.get('from', {}).get('first_name', '?')}: {text}")
                # Update offset after poll
                offset = _read_offset()
            except asyncio.CancelledError:
                log("LISTENER", "Listener cancelled")
                break
            except Exception as e:
                log("LISTENER", f"Listener error: {e}", level=40)

            await asyncio.sleep(POLL_INTERVAL)


# ============================================================
# API helpers (used by routers/telegram_inbox_api.py)
# ============================================================

def _load_all_messages() -> list[dict]:
    """Load all inbox messages sorted by date ascending."""
    _ensure_inbox_dir()
    messages = []
    for path in sorted(INBOX_DIR.glob("msg_*.json")):
        try:
            messages.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            pass
    return messages


def get_unread_messages() -> list[dict]:
    """Get all messages where acknowledged=False."""
    return [m for m in _load_all_messages() if not m.get("acknowledged")]


def get_all_messages() -> list[dict]:
    """Get all messages with latest first."""
    msgs = _load_all_messages()
    msgs.reverse()
    return msgs


def acknowledge_message(update_id: int) -> bool:
    """Mark a single message as acknowledged."""
    path = _message_path(update_id)
    if not path.exists():
        return False
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
        record["acknowledged"] = True
        record["acked_at"] = _now_iso()
        path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        return True
    except (json.JSONDecodeError, OSError):
        return False


def acknowledge_all() -> int:
    """Mark all unread messages as acknowledged. Returns count."""
    count = 0
    for m in _load_all_messages():
        if not m.get("acknowledged"):
            if acknowledge_message(m["update_id"]):
                count += 1
    return count


def get_status() -> dict:
    """Return inbox status."""
    all_msgs = _load_all_messages()
    unread = [m for m in all_msgs if not m.get("acknowledged")]
    return {
        "total": len(all_msgs),
        "unread": len(unread),
        "last_update": _now_iso(),
    }
