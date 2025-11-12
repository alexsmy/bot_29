import os
import glob
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from core import CustomJSONResponse

RECORDS_DIR = "call_records"
router = APIRouter()

def sanitize_filename(filename: str) -> str:
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return filename

@router.get("/recordings", response_class=CustomJSONResponse)
async def list_recordings():
    try:
        if not os.path.exists(RECORDS_DIR):
            return []
        files = glob.glob(os.path.join(RECORDS_DIR, "*.webm"))
        filenames = sorted([os.path.basename(f) for f in files], reverse=True)
        return filenames
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list recordings: {e}")

@router.get("/recordings/{filename}")
async def get_recording(filename: str):
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(RECORDS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Recording not found.")
    
    return FileResponse(
        path=filepath, 
        media_type='audio/webm',
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