
# bot_29-main/routes/admin/recordings.py

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from collections import defaultdict

from core import CustomJSONResponse

RECORDS_DIR = "call_records"
router = APIRouter()

def sanitize_filename(filename: str) -> str:
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return filename

@router.get("/recordings", response_class=CustomJSONResponse)
async def list_recordings():
    """
    Возвращает список сессий звонков с их файлами (аудио, транскрипции, диалоги).
    """
    try:
        if not os.path.exists(RECORDS_DIR):
            return []
        
        sessions = defaultdict(lambda: {"session_id": "", "files": []})
        
        # Сортируем файлы, чтобы они обрабатывались в предсказуемом порядке
        sorted_files = sorted(os.listdir(RECORDS_DIR), reverse=True)

        for filename in sorted_files:
            if not filename.endswith(('.webm', '.txt')):
                continue
            
            # Ключ сессии - это YYYYMMDD_HHMMSS_roomid
            parts = filename.split('_')
            if len(parts) < 3:
                continue # Пропускаем некорректные имена файлов
            
            session_id = "_".join(parts[:3])
            
            sessions[session_id]["session_id"] = session_id
            sessions[session_id]["files"].append(filename)
        
        return list(sessions.values())

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list recordings: {e}")

@router.get("/recordings/{filename}")
async def get_recording(filename: str):
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(RECORDS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Recording not found.")
    
    media_type = 'application/octet-stream'
    if safe_filename.endswith('.webm'):
        media_type = 'audio/webm'
    elif safe_filename.endswith('.txt'):
        media_type = 'text/plain'

    return FileResponse(
        path=filepath, 
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={safe_filename}"}
    )

@router.delete("/recordings/{filename}", response_class=CustomJSONResponse)
async def delete_recording(filename: str):
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(RECORDS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Recording not found.")
    try:
        os.remove(filepath)
        return {"status": "deleted", "filename": safe_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete recording: {e}")