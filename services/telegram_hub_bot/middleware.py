from __future__ import annotations

from aiogram import BaseMiddleware
import os

from services.telegram_listener import save_incoming_update


class InboxCaptureMiddleware(BaseMiddleware):
    async def __call__(self, handler, event, data):
        update = data.get("event_update")
        if update is not None:
            try:
                payload = update.model_dump(mode="json")
            except Exception:
                try:
                    payload = update.model_dump()
                except Exception:
                    payload = None
            if isinstance(payload, dict):
                try:
                    save_incoming_update(payload)
                except Exception:
                    pass
        return await handler(event, data)


class AllowedUsersMiddleware(BaseMiddleware):
    def __init__(self) -> None:
        raw = os.environ.get("TELEGRAM_CHAT_ID", "")
        self.allowed = {item.strip() for item in raw.split(",") if item.strip()}

    async def __call__(self, handler, event, data):
        if not self.allowed:
            return await handler(event, data)
        user = getattr(event, "from_user", None)
        user_id = str(getattr(user, "id", "")) if user else ""
        if user_id in self.allowed:
            return await handler(event, data)
        if hasattr(event, "answer"):
            try:
                await event.answer("⛔️ Нет доступа к этому боту.")
            except Exception:
                pass
        return None
