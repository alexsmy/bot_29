# routes/admin/auth.py

from datetime import datetime, timezone
from typing import Optional
from fastapi import Request, HTTPException, status

import database

async def verify_admin_token(request: Request, token: str) -> str:
    """
    Зависимость (dependency) для проверки токена администратора.
    Проверяет, что токен существует и не истек.
    """
    expires_at: Optional[datetime] = await database.get_admin_token_expiry(token)
    if not expires_at:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or expired token")
    
    # Сохраняем время истечения токена в состоянии запроса для использования в других местах
    request.state.token_expires_at = expires_at
    return token