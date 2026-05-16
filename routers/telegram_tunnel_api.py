from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Request, Response
from services.telegram_tunnel import read_incoming_payload, send_tunnel_message, tunnel_status

router = APIRouter(tags=["telegram"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"


@router.api_route("/mytelegram", methods=["GET", "POST"])
async def telegram_tunnel(request: Request, response: Response) -> Dict[str, Any]:
    """
    Универсальная точка входа для любых приложений:
    - GET /mytelegram?payload=...
    - GET /mytelegram?text=...
    - POST /mytelegram с JSON-телом
    """
    _no_store(response)

    raw_payload = await read_incoming_payload(request)
    result = await send_tunnel_message(request, raw_payload)
    return result


@router.get("/mytelegram/health")
async def telegram_tunnel_health(response: Response) -> Dict[str, Any]:
    _no_store(response)
    return await tunnel_status()
