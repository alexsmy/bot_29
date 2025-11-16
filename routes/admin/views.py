
# routes/admin/views.py

import os
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse

from .auth import verify_admin_token
from core import templates

router = APIRouter()

@router.get("/admin/{token}", response_class=HTMLResponse)
async def get_admin_page(request: Request, token: str = Depends(verify_admin_token)):
    """
    Отдает HTML-страницу админ-панели.
    """
    expires_at_iso = request.state.token_expires_at.isoformat()
    return templates.TemplateResponse("admin.html", {"request": request, "token": token, "expires_at": expires_at_iso})