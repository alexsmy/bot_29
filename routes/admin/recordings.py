import os
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import List

from core import CustomJSONResponse
from configurable_logger import log

RECORDS_DIR = "call_records"
router = APIRouter()

def sanitize_path_component(component: str) -> str:
    """Проверяет компонент пути на наличие опасных последовательностей."""
    if ".." in component or "/" in component or "\\" in component:
        raise HTTPException(status_code=400, detail="Invalid path component.")
    return component

@router.get("/recordings", response_class=CustomJSONResponse)
async def list_recordings():
    """
    Возвращает список папок сессий звонков с их файлами.
    """
    if not os.path.exists(RECORDS_DIR) or not os.path.isdir(RECORDS_DIR):
        return []

    sessions = []
    try:
        # Сканируем директорию и фильтруем только папки
        session_dirs = sorted(
            [d.name for d in os.scandir(RECORDS_DIR) if d.is_dir()],
            reverse=True
        )

        for dir_name in session_dirs:
            session_path = os.path.join(RECORDS_DIR, dir_name)
            try:
                # Получаем список файлов внутри папки сессии
                files = sorted(
                    [f for f in os.listdir(session_path) if os.path.isfile(os.path.join(session_path, f))],
                    reverse=True
                )
                sessions.append({
                    "session_id": dir_name,
                    "files": files
                })
            except OSError as e:
                log("ERROR", f"Не удалось прочитать содержимое папки {session_path}: {e}", level=logging.ERROR)
                continue
        
        return sessions

    except Exception as e:
        log("ERROR", f"Ошибка при листинге записей: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail=f"Failed to list recordings: {e}")

@router.get("/recordings/{session_id}/{filename}")
async def get_recording(session_id: str, filename: str):
    """Скачивает конкретный файл из папки сессии."""
    safe_session_id = sanitize_path_component(session_id)
    safe_filename = sanitize_path_component(filename)
    
    filepath = os.path.join(RECORDS_DIR, safe_session_id, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Recording not found.")
    
    media_type = 'application/octet-stream'
    if safe_filename.endswith('.webm'):
        media_type = 'audio/webm'
    elif safe_filename.endswith('.txt'):
        media_type = 'text/plain'
    elif safe_filename.endswith('.png'):
        media_type = 'image/png'

    return FileResponse(
        path=filepath, 
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={safe_filename}"}
    )

@router.delete("/recordings/{session_id}/{filename}", response_class=CustomJSONResponse)
async def delete_recording(session_id: str, filename: str):
    """Удаляет конкретный файл из папки сессии."""
    safe_session_id = sanitize_path_component(session_id)
    safe_filename = sanitize_path_component(filename)

    filepath = os.path.join(RECORDS_DIR, safe_session_id, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Recording not found.")
    try:
        os.remove(filepath)
        log("ADMIN_ACTION", f"Администратор удалил файл: {filepath}")
        return {"status": "deleted", "filename": safe_filename}
    except Exception as e:
        log("ERROR", f"Ошибка при удалении файла {filepath}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail=f"Failed to delete recording: {e}")