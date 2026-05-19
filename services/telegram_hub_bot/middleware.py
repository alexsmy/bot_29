from __future__ import annotations

from aiogram import BaseMiddleware

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
