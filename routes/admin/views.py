# routes/admin/views.py

import os
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse

from .auth import verify_admin_token
from .reports import sanitize_filename, LOGS_DIR
from core import templates

router = APIRouter()

@router.get("/admin/{token}", response_class=HTMLResponse)
async def get_admin_page(request: Request, token: str = Depends(verify_admin_token)):
    """
    Отдает HTML-страницу админ-панели.
    """
    expires_at_iso = request.state.token_expires_at.isoformat()
    return templates.TemplateResponse("admin.html", {"request": request, "token": token, "expires_at": expires_at_iso})

@router.get("/admin/reports/{filename}")
async def get_report(filename: str, download: bool = False, token: str = Depends(verify_admin_token)):
    """
    Отдает HTML-страницу отчета или предоставляет его для скачивания.
    """
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(LOGS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found.")
    
    headers = {}
    if download:
        headers["Content-Disposition"] = f"attachment; filename={safe_filename}"
        
    return FileResponse(path=filepath, headers=headers, media_type='text/html')