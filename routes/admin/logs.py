import os
import logging
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import PlainTextResponse

from core import CustomJSONResponse
from configurable_logger import log
from logger_config import LOG_FILE_PATH

router = APIRouter()

@router.get("/logs", response_class=PlainTextResponse)
async def get_app_logs():
    """
    Возвращает содержимое файла логов приложения.
    """
    try:
        if not os.path.exists(LOG_FILE_PATH):
            return "Файл логов еще не создан."
        with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        log("ERROR", f"Ошибка чтения файла логов: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Could not read log file.")

@router.get("/logs/download")
async def download_app_logs():
    """
    Предоставляет файл логов для скачивания.
    """
    if not os.path.exists(LOG_FILE_PATH):
        raise HTTPException(status_code=404, detail="Log file not found.")
    try:
        with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(
            content=content,
            media_type='text/plain',
            headers={"Content-Disposition": "attachment; filename=app.log"}
        )
    except Exception as e:
        log("ERROR", f"Ошибка при чтении файла логов для скачивания: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Could not read log file for download.")

@router.delete("/logs", response_class=CustomJSONResponse)
async def clear_app_logs():
    """
    Очищает файл логов приложения.
    """
    try:
        if os.path.exists(LOG_FILE_PATH):
            with open(LOG_FILE_PATH, 'w') as f:
                f.truncate(0)
            log("ADMIN_ACTION", "Файл логов был очищен администратором.")
            return {"status": "log file cleared"}
        return {"status": "log file not found"}
    except Exception as e:
        log("ERROR", f"Ошибка при очистке файла логов: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Could not clear log file.")