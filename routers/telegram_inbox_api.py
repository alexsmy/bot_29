"""
API router for reading incoming Telegram messages (duplex mode).

Endpoints:
  GET  /api/telegram/inbox          — list unread messages
  POST /api/telegram/inbox/ack      — acknowledge all as read
  POST /api/telegram/inbox/{id}/ack — acknowledge specific message
  GET  /api/telegram/inbox/status   — inbox stats
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, Response

from services.telegram_listener import (
    acknowledge_all,
    acknowledge_message,
    get_all_messages,
    get_status,
    get_unread_messages,
)
from services.agents.tunnel import _require_secret

router = APIRouter(prefix="/api/telegram", tags=["telegram-inbox"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"


@router.get("/inbox")
async def inbox_list(request: Request, response: Response) -> Dict[str, Any]:
    """Get all unread messages from Telegram inbox."""
    _no_store(response)
    _require_secret(request)
    messages = get_unread_messages()
    return {"ok": True, "messages": messages, "count": len(messages)}


@router.post("/inbox/ack")
async def inbox_ack_all(request: Request, response: Response) -> Dict[str, Any]:
    """Acknowledge all unread messages as read."""
    _no_store(response)
    _require_secret(request)
    count = acknowledge_all()
    return {"ok": True, "acknowledged": count}


@router.post("/inbox/{update_id}/ack")
async def inbox_ack_one(update_id: int, request: Request, response: Response) -> Dict[str, Any]:
    """Acknowledge a specific message by update_id."""
    _no_store(response)
    _require_secret(request)
    if not acknowledge_message(update_id):
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True, "update_id": update_id}


@router.get("/inbox/status")
async def inbox_status(request: Request, response: Response) -> Dict[str, Any]:
    """Get inbox stats."""
    _no_store(response)
    _require_secret(request)
    status = get_status()
    return {"ok": True, **status}


@router.get("/inbox/all")
async def inbox_all(request: Request, response: Response) -> Dict[str, Any]:
    """Get ALL messages (including acknowledged), newest first."""
    _no_store(response)
    _require_secret(request)
    messages = get_all_messages()
    return {"ok": True, "messages": messages, "count": len(messages)}
