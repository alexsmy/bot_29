"""
API-роутер для управления агентами и MCP-инструментами.

Содержит эндпоинты:
  - /inbox — приём команд для ALM-агентов (старый протокол)
  - /health — статус системы
  - /list — список всех зарегистрированных агентов
  - /upload — загрузить нового динамического агента
  - /mcp-tools/register — загрузить MCP-инструмент (без передеплоя!)
  - /mcp-tools/list — список MCP-инструментов
  - /mcp-tools/{name} — удалить MCP-инструмент
  - /responses — история ответов агентов
  - /responses/{file_id} — конкретный ответ
"""

from __future__ import annotations

import hmac
import json
import re
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, Response

from services.agents.registry import (
    DYNAMIC_AGENTS_DIR,
    import_and_register_dynamic_agent,
    is_builtin,
    list_agents,
    unregister_dynamic_agent,
)
from services.agents.storage import FILEVAULT_ROOT, save_agent_code_to_filevault
from services.agents.tunnel import (
    get_agent_tunnel_status,
    handle_agent_request,
    load_tunnel_secret,
    read_agent_payload,
)

# Импортируем функции MCP-сервера для регистрации динамических инструментов
# через API (без передеплоя приложения)
from services.agents.mcp_server import (
    register_dynamic_tool as _register_mcp_tool,
    remove_dynamic_tool as _remove_mcp_tool,
    list_dynamic_tools as _list_mcp_tools,
)

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _no_store(response: Response) -> None:
    """Запретить кеширование ответа."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"


def _check_secret(request: Request) -> None:
    """
    Проверить X-Agents-Tunnel-Secret заголовок.
    Если секрет не установлен (None/пусто) — пропускаем всех.
    """
    secret = load_tunnel_secret()
    if not secret:
        return
    provided = request.headers.get("x-agents-tunnel-secret") or ""
    if not hmac.compare_digest(str(provided), secret):
        raise HTTPException(status_code=403, detail="Неверный секрет агентов")


@router.api_route("/inbox", methods=["GET", "POST"])
async def agent_inbox(request: Request, response: Response) -> Dict[str, Any]:
    """Приёмник команд для серверных агентов (старый ALM-протокол)."""
    _no_store(response)
    payload = await read_agent_payload(request)
    return await handle_agent_request(request, payload)


@router.get("/health")
async def agent_health(response: Response) -> Dict[str, Any]:
    """Статус системы агентов."""
    _no_store(response)
    return await get_agent_tunnel_status()


@router.get("/list")
async def agent_list(request: Request, response: Response) -> Dict[str, Any]:
    """Список всех зарегистрированных агентов (ALM + встроенные)."""
    _no_store(response)
    _check_secret(request)
    return {
        "ok": True,
        "agents": list_agents(),
    }


@router.post("/upload")
async def agent_upload(request: Request, response: Response) -> Dict[str, Any]:
    """
    Загрузить и зарегистрировать нового динамического агента.

    Тело (JSON):
      { "name": "имя_агента", "code": "полный Python-код" }

    Код должен содержать переменную NAME и функцию run(query, args).
    """
    _no_store(response)
    _check_secret(request)

    body = await request.json()
    name = str(body.get("name", "")).strip()
    code = str(body.get("code", "")).strip()

    if not name or not code:
        raise HTTPException(status_code=422, detail="Поля 'name' и 'code' обязательны")

    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", name):
        raise HTTPException(status_code=422,
                            detail="Некорректное имя агента. Только буквы, цифры, underscore.")

    if is_builtin(name):
        raise HTTPException(status_code=409,
                            detail=f"Агент '{name}' встроенный — нельзя перезаписать")

    file_path = DYNAMIC_AGENTS_DIR / f"{name}.py"
    file_path.write_text(code, encoding="utf-8")

    ok = import_and_register_dynamic_agent(file_path)
    if not ok:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=422,
                            detail="Не удалось загрузить агента: в коде не найден NAME + run(query, args)")

    # Сохраняем копию в FileVault (для восстановления)
    code_artifact = save_agent_code_to_filevault(name, code)

    return {
        "ok": True,
        "action": "uploaded",
        "agent": name,
        "path": str(file_path),
        "filevault": {
            "file_id": code_artifact.file_id,
            "original_name": code_artifact.original_name,
        },
    }


# ============================================================
# MCP-ИНСТРУМЕНТЫ — загрузка без передеплоя
# ============================================================
# Эти эндпоинты позволяют добавлять новые MCP-инструменты на лету,
# простой POST-запросом с Python-кодом.
# Не нужно перезапускать сервер или делать git push!

@router.post("/mcp-tools/register")
async def register_mcp_tool(request: Request, response: Response) -> Dict[str, Any]:
    """
    Загрузить и зарегистрировать новый MCP-инструмент (без передеплоя!).

    Тело (JSON):
      { "name": "имя_инструмента",
        "code": "async def имя(param1: str, param2: int = 0) -> str: ...",
        "description": "описание (опционально)" }

    Код должен содержать async-функцию с именем, совпадающим с name.
    Параметры функции автоматически становятся inputSchema MCP.

    Пример кода:
        async def hello(name: str) -> str:
            return f"Привет, {name}!"
    """
    _no_store(response)
    _check_secret(request)

    body = await request.json()
    name = str(body.get("name", "")).strip()
    code = str(body.get("code", "")).strip()
    description = body.get("description")

    if not name or not code:
        raise HTTPException(status_code=422, detail="Поля 'name' и 'code' обязательны")

    result = _register_mcp_tool(name, code, description)

    if not result.get("ok"):
        raise HTTPException(status_code=422, detail=result.get("error", "Неизвестная ошибка"))

    return result


@router.get("/mcp-tools/list")
async def list_mcp_tools(request: Request, response: Response) -> Dict[str, Any]:
    """Список всех загруженных MCP-инструментов."""
    _no_store(response)
    _check_secret(request)

    return {
        "ok": True,
        "tools": _list_mcp_tools(),
    }


@router.delete("/mcp-tools/{name}")
async def remove_mcp_tool(name: str, request: Request, response: Response) -> Dict[str, Any]:
    """Удалить загруженный MCP-инструмент по имени."""
    _no_store(response)
    _check_secret(request)

    result = _remove_mcp_tool(name)

    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "Не найден"))

    return result


# ============================================================
# ОТВЕТЫ АГЕНТОВ (история)
# ============================================================

@router.get("/responses")
async def agent_responses(request: Request, response: Response) -> Dict[str, Any]:
    """Список ответов агентов из FileVault (папка Agents)."""
    _no_store(response)
    _check_secret(request)

    records = []
    for meta_path in sorted(FILEVAULT_ROOT.glob("*.json"),
                            key=lambda p: p.stat().st_mtime, reverse=True):
        if meta_path.name == "_folders.json":
            continue
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(meta, dict):
            continue
        name = meta.get("original_name", "")
        if name.startswith("agent-response-") or name.startswith("agent-code-"):
            records.append({
                "file_id": meta.get("file_id"),
                "original_name": name,
                "size_bytes": meta.get("size_bytes", 0),
                "uploaded_at": meta.get("uploaded_at"),
            })

    return {"ok": True, "responses": records}


@router.get("/responses/{file_id}")
async def agent_response_detail(
    file_id: str, request: Request, response: Response
) -> Dict[str, Any]:
    """Детальный ответ агента по file_id."""
    _no_store(response)
    _check_secret(request)

    blob_path = FILEVAULT_ROOT / f"{file_id}.bin"
    meta_path = FILEVAULT_ROOT / f"{file_id}.json"

    if not blob_path.exists() or not meta_path.exists():
        raise HTTPException(status_code=404, detail="Ответ не найден")

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        data = json.loads(blob_path.read_bytes().decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка чтения: {e}")

    return {"ok": True, "meta": meta, "data": data}


@router.delete("/dynamic/{name}")
async def agent_delete(name: str, request: Request, response: Response) -> Dict[str, Any]:
    """Удалить динамического агента."""
    _no_store(response)
    _check_secret(request)

    if is_builtin(name):
        raise HTTPException(status_code=400, detail="Нельзя удалить встроенного агента")

    file_path = DYNAMIC_AGENTS_DIR / f"{name}.py"
    if file_path.exists():
        file_path.unlink()

    if not unregister_dynamic_agent(name):
        raise HTTPException(status_code=404, detail=f"Агент '{name}' не найден")

    return {"ok": True, "action": "deleted", "agent": name}
