from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from config.config_manager import load_advanced_config, save_advanced_config
from config.keepalive_security import ConfigTamperError
from services.keep_alive import request_runtime_reload
from services.keepalive_auth import (
    authenticate_pin,
    clear_auth_cookie,
    create_auth_token,
    get_pin_attempt_status,
    require_settings_auth,
    set_auth_cookie,
)

router = APIRouter(prefix="/api/keepalive", tags=["keepalive"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"


@router.get("/auth/status")
async def get_keepalive_auth_status(request: Request, response: Response) -> Dict[str, Any]:
    """Возвращает состояние защиты PIN без раскрытия конфигурации."""
    _no_store(response)
    return get_pin_attempt_status(request)


@router.post("/auth/pin")
async def unlock_keepalive_settings(request: Request, payload: Dict[str, Any]) -> JSONResponse:
    """Проверяет PIN и выдаёт короткоживущий HttpOnly-cookie для настроек."""
    pin = str(payload.get("pin", "")).strip()
    result = authenticate_pin(request, pin)
    response = JSONResponse(result)
    forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
    secure_cookie = request.url.scheme == "https" or forwarded_proto == "https"
    set_auth_cookie(response, create_auth_token(), secure=secure_cookie)
    _no_store(response)
    return response


@router.post("/auth/logout")
async def lock_keepalive_settings(response: Response) -> Dict[str, Any]:
    """Закрывает доступ к окну настроек на текущем устройстве."""
    clear_auth_cookie(response)
    _no_store(response)
    return {"ok": True}


@router.get("/config")
async def get_keepalive_config(request: Request, response: Response) -> Dict[str, Any]:
    """Возвращает текущую публичную конфигурацию keep-alive после PIN-проверки."""
    require_settings_auth(request)
    _no_store(response)
    try:
        return load_advanced_config(public=True, strict_integrity=True)
    except ConfigTamperError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.put("/config")
async def update_keepalive_config(request: Request, response: Response, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Сохраняет конфигурацию и перезапускает фоновые мониторы после PIN-проверки."""
    require_settings_auth(request)
    _no_store(response)
    try:
        normalized = save_advanced_config(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Не удалось сохранить конфигурацию: {error}") from error

    await request_runtime_reload()
    return {"ok": True, "config": normalized}


@router.get("/config/download")
async def download_keepalive_config(request: Request) -> Response:
    """Отдаёт публичный конфиг как файл для скачивания после PIN-проверки."""
    require_settings_auth(request)
    config = load_advanced_config(public=True, strict_integrity=True)
    content = json.dumps(config, ensure_ascii=False, indent=4) + "\n"
    return Response(
        content=content,
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="keep_alive_settings.json"',
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
        },
    )


@router.post("/reload")
async def reload_keepalive_runtime(request: Request, response: Response) -> Dict[str, Any]:
    """Перечитывает текущий конфиг и перезапускает runtime после PIN-проверки."""
    require_settings_auth(request)
    _no_store(response)
    await request_runtime_reload()
    return {"ok": True}
