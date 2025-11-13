# bot_29-main/routes/admin/recordings.py

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

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
    Возвращает сгруппированный список аудиозаписей и их транскрипций.
    """
    try:
        if not os.path.exists(RECORDS_DIR):
            return []
        
        files_map = {}
        for filename in os.listdir(RECORDS_DIR):
            if not filename.endswith(('.webm', '.txt')):
                continue
            
            base_name, ext = os.path.splitext(filename)
            if base_name not in files_map:
                files_map[base_name] = {"name": base_name, "has_webm": False, "has_txt": False}
            
            if ext == '.webm':
                files_map[base_name]["has_webm"] = True
            elif ext == '.txt':
                files_map[base_name]["has_txt"] = True
        
        # Сортируем по имени (которое содержит дату) в обратном порядке
        sorted_list = sorted(files_map.values(), key=lambda x: x['name'], reverse=True)
        return sorted_list

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