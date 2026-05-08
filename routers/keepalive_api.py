from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from config.config_manager import load_advanced_config, save_advanced_config
from services.keep_alive import request_runtime_reload

router = APIRouter(prefix="/api/keepalive", tags=["keepalive"])


@router.get("/config")
async def get_keepalive_config() -> Dict[str, Any]:
    """Возвращает текущую конфигурацию keep-alive."""
    return load_advanced_config()


@router.put("/config")
async def update_keepalive_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Сохраняет конфигурацию и перезапускает фоновые мониторы."""
    try:
        normalized = save_advanced_config(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Не удалось сохранить конфигурацию: {error}") from error

    await request_runtime_reload()
    return {"ok": True, "config": normalized}


@router.get("/config/download")
async def download_keepalive_config() -> Response:
    """Отдаёт конфиг как файл для скачивания."""
    config = load_advanced_config()
    content = json.dumps(config, ensure_ascii=False, indent=4) + "\n"
    return Response(
        content=content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="keep_alive_settings.json"'},
    )


@router.post("/reload")
async def reload_keepalive_runtime() -> Dict[str, Any]:
    """Перечитывает текущий конфиг и перезапускает runtime."""
    await request_runtime_reload()
    return {"ok": True}