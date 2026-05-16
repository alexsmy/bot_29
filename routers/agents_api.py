from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Request, Response

from services.agents.tunnel import get_agent_tunnel_status, handle_agent_request, read_agent_payload

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"


@router.api_route("/inbox", methods=["GET", "POST"])
async def agent_inbox(request: Request, response: Response) -> Dict[str, Any]:
    """Приёмник команд для будущих серверных агентов."""
    _no_store(response)
    payload = await read_agent_payload(request)
    return await handle_agent_request(request, payload)


@router.get("/health")
async def agent_health(response: Response) -> Dict[str, Any]:
    _no_store(response)
    return await get_agent_tunnel_status()
