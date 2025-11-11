# routes/admin/reports.py

import os
import glob
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from core import CustomJSONResponse

LOGS_DIR = "connection_logs"
router = APIRouter()

def sanitize_filename(filename: str) -> str:
    """
    Проверяет имя файла на наличие опасных последовательностей.
    """
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return filename

@router.get("/reports", response_class=CustomJSONResponse)
async def list_reports():
    """
    Возвращает список всех доступных HTML-отчетов.
    """
    try:
        files = glob.glob(os.path.join(LOGS_DIR, "*.html"))
        filenames = sorted([os.path.basename(f) for f in files], reverse=True)
        return filenames
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reports: {e}")

@router.delete("/reports/{filename}", response_class=CustomJSONResponse)
async def delete_report(filename: str):
    """
    Удаляет указанный файл отчета.
    """
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(LOGS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found.")
    try:
        os.remove(filepath)
        return {"status": "deleted", "filename": safe_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {e}")

@router.delete("/reports", response_class=CustomJSONResponse)
async def delete_all_reports():
    """
    Удаляет все файлы отчетов.
    """
    try:
        files = glob.glob(os.path.join(LOGS_DIR, "*.html"))
        for f in files:
            os.remove(f)
        return {"status": "all deleted", "count": len(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete all reports: {e}")