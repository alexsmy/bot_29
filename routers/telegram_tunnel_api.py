# Эндпоинт /mytelegram — быстрая отправка сообщений в Telegram.
# Поддерживает GET и POST, текст, JSON, base64-url.
# Используется для простых одноразовых сообщений (уведомления, пинги).
# Для сложной отправки (файлы, медиа, редактирование) — MCP send_telegram_message.

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Request, Response
from services.telegram_tunnel import read_incoming_payload, send_tunnel_message, tunnel_status

router = APIRouter(tags=["telegram"])


def _no_store(response: Response) -> None:
    """Запрет кеширования для всех ответов эндпоинта."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"


@router.api_route("/mytelegram", methods=["GET", "POST"])
async def telegram_tunnel(request: Request, response: Response) -> Dict[str, Any]:
    """
    Единая точка входа для отправки в Telegram.
    GET:  /mytelegram?text=Привет&secret=...   (простой текст)
    GET:  /mytelegram?payload={"text":"..."}    (JSON в query)
    POST: /mytelegram с JSON-телом              (полный контроль)
    """
    _no_store(response)
    raw_payload = await read_incoming_payload(request)
    result = await send_tunnel_message(request, raw_payload)
    return result


@router.get("/mytelegram/health")
async def telegram_tunnel_health(response: Response) -> Dict[str, Any]:
    """Проверка состояния туннеля."""
    _no_store(response)
    return await tunnel_status()
