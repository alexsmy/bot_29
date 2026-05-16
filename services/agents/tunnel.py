from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Request, status

from .base import AgentCommand
from .registry import get_agent, has_agent, list_agents, normalize_agent_name
from .storage import (
    archive_agent_payload,
    save_agent_response_to_filevault,
    store_agent_job,
    store_agent_outbox,
    utc_now_iso,
)

MAX_QUERY_LENGTH = 12000


def load_tunnel_secret() -> str | None:
    secret = str(os.environ.get("AGENTS_TUNNEL_SECRET", "")).strip()
    return secret or None


def _require_secret(request: Request) -> None:
    secret = load_tunnel_secret()
    if not secret:
        return

    provided = (
        request.headers.get("x-agents-tunnel-secret")
        or request.headers.get("x-tunnel-secret")
        or request.query_params.get("secret")
        or ""
    )

    if not hmac.compare_digest(str(provided), secret):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Неверный секрет агентов")


def _decode_base64_json(value: str) -> dict[str, Any]:
    padded = value + "=" * (-len(value) % 4)
    decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
    payload = json.loads(decoded)
    if not isinstance(payload, dict):
        raise ValueError("payload is not an object")
    return payload


def _parse_query_payload(request: Request) -> dict[str, Any]:
    params = dict(request.query_params)

    if "payload" in params:
        payload = json.loads(params["payload"])
        if not isinstance(payload, dict):
            raise HTTPException(status_code=422, detail="payload должен быть JSON-объектом")
        return payload

    if "data" in params:
        try:
            return _decode_base64_json(params["data"])
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Не удалось распарсить data: {exc}") from exc

    if "query" in params or "text" in params or "input" in params:
        return {
            "agent": params.get("agent") or "test_echo",
            "query": params.get("query") or params.get("text") or params.get("input") or "",
            "kind": params.get("kind") or "single",
            "format": params.get("format") or "json",
            "args": {},
        }

    raise HTTPException(
        status_code=422,
        detail="Передайте JSON body, payload, data или query/text/input в query string.",
    )


async def read_agent_payload(request: Request) -> dict[str, Any]:
    if request.method.upper() == "POST":
        content_type = (request.headers.get("content-type") or "").lower()
        if "application/json" in content_type:
            body = await request.json()
            if isinstance(body, dict):
                return body
            raise HTTPException(status_code=422, detail="JSON-тело должно быть объектом")
    return _parse_query_payload(request)


def _normalize_payload(raw_payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise HTTPException(status_code=422, detail="Ожидался JSON-объект")

    agent = normalize_agent_name(raw_payload.get("agent"))
    query = str(
        raw_payload.get("query")
        or raw_payload.get("text")
        or raw_payload.get("input")
        or raw_payload.get("message")
        or raw_payload.get("command")
        or ""
    ).strip()
    if not query:
        raise HTTPException(status_code=422, detail="Поле query не должно быть пустым")

    if len(query) > MAX_QUERY_LENGTH:
        raise HTTPException(status_code=413, detail="Слишком длинный запрос для агента")

    args = raw_payload.get("args")
    if args is None:
        args = {}
    if not isinstance(args, dict):
        raise HTTPException(status_code=422, detail="Поле args должно быть JSON-объектом")

    request_id = str(
        raw_payload.get("request_id")
        or raw_payload.get("job_id")
        or hashlib.sha1(f"{agent}:{query}:{utc_now_iso()}".encode("utf-8")).hexdigest()[:16]
    )

    response_format = str(raw_payload.get("response_format") or raw_payload.get("format") or "json").strip().lower()
    if response_format not in {"json", "plain"}:
        response_format = "json"

    kind = str(raw_payload.get("kind") or "single").strip().lower()
    if kind not in {"single", "file", "command"}:
        kind = "single"

    return {
        "agent": agent,
        "query": query,
        "args": args,
        "request_id": request_id,
        "response_format": response_format,
        "kind": kind,
        "raw": raw_payload,
        "received_at": utc_now_iso(),
    }


async def handle_agent_request(request: Request, raw_payload: dict[str, Any]) -> dict[str, Any]:
    _require_secret(request)
    payload = _normalize_payload(raw_payload)

    if not has_agent(payload["agent"]):
        raise HTTPException(
            status_code=404,
            detail={
                "error": f"Неизвестный агент: {payload['agent']}",
                "available_agents": list_agents(),
            },
        )

    command = AgentCommand(
        agent=payload["agent"],
        query=payload["query"],
        request_id=payload["request_id"],
        raw=payload["raw"],
        received_at=payload["received_at"],
    )

    job_record = {
        "request_id": payload["request_id"],
        "agent": payload["agent"],
        "query": payload["query"],
        "args": payload["args"],
        "kind": payload["kind"],
        "response_format": payload["response_format"],
        "received_at": payload["received_at"],
        "source": {
            "method": request.method,
            "path": str(request.url.path),
            "client": request.client.host if request.client else None,
        },
    }
    job_disk_path = store_agent_job(payload["request_id"], job_record)

    agent = get_agent(payload["agent"])
    agent_output = await agent.run(command)

    response_payload = {
        "ok": True,
        "agent": payload["agent"],
        "request_id": payload["request_id"],
        "received_at": payload["received_at"],
        "completed_at": utc_now_iso(),
        "query": payload["query"],
        "args": payload["args"],
        "result": agent_output,
        "channel": "server-file",
        "version": 1,
    }

    outbox_disk_path = store_agent_outbox(payload["request_id"], response_payload)
    archive_agent_payload(payload["request_id"], {
        "job": job_record,
        "response": response_payload,
    })

    stored_file = save_agent_response_to_filevault(payload["agent"], payload["request_id"], response_payload)

    return {
        "ok": True,
        "accepted": True,
        "agent": payload["agent"],
        "request_id": payload["request_id"],
        "query": payload["query"],
        "response_format": payload["response_format"],
        "kind": payload["kind"],
        "job_disk_path": job_disk_path,
        "outbox_disk_path": outbox_disk_path,
        "response_file": {
            "file_id": stored_file.file_id,
            "original_name": stored_file.original_name,
            "blob_path": stored_file.blob_path,
            "meta_path": stored_file.meta_path,
            "public_name": stored_file.public_name,
            "size_bytes": stored_file.size_bytes,
            "uploaded_at": stored_file.uploaded_at,
        },
        "available_agents": list_agents(),
        "tunnel": "agents",
    }


async def get_agent_tunnel_status() -> dict[str, Any]:
    secret = load_tunnel_secret()
    return {
        "ok": True,
        "configured": bool(list_agents()),
        "secret_required": bool(secret),
        "agents": list_agents(),
        "storage": {
            "inbox_dir": str(Path("data/agents/inbox")),
            "outbox_dir": str(Path("data/agents/outbox")),
            "archive_dir": str(Path("data/agents/archive")),
            "dynamic_dir": str(Path("data/agents/dynamic")),
            "filevault_root": str(Path("data/filevault_uploads")),
            "agents_filevault_folder": "Agents (доступ через /files)",
        },
    }
