# bot_29-main/routes/admin/users.py
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import database
from core import CustomJSONResponse
from configurable_logger import log
from data_layer.user_queries import import_users_batch

router = APIRouter()

# Модель для валидации данных при импорте
class UserImportSchema(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    first_seen: datetime
    status: str = 'active'

@router.get("/users", response_class=CustomJSONResponse)
async def get_admin_users():
    """
    Возвращает список всех пользователей.
    """
    users = await database.get_users_info()
    return users

@router.post("/users/import", response_class=CustomJSONResponse)
async def import_users(users: List[UserImportSchema]):
    """
    Импортирует список пользователей в базу данных.
    """
    try:
        # Преобразуем Pydantic модели в словари
        users_data = [user.dict() for user in users]
        await import_users_batch(users_data)
        return {"status": "ok", "message": f"Successfully imported {len(users)} users."}
    except Exception as e:
        log("ERROR", f"Ошибка при импорте пользователей: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail=f"Failed to import users: {str(e)}")

@router.get("/user_actions/{user_id}", response_class=CustomJSONResponse)
async def get_admin_user_actions(user_id: int):
    """
    Возвращает историю действий для конкретного пользователя.
    """
    actions = await database.get_user_actions(user_id)
    return actions

# --- ИЗМЕНЕННЫЕ ЭНДПОИНТЫ ---

@router.post("/user/{user_id}/block", response_class=CustomJSONResponse)
async def block_user(user_id: int):
    """Принудительно блокирует пользователя."""
    try:
        await database.update_user_status(user_id, 'blocked')
        return {"status": "ok", "message": f"User {user_id} blocked."}
    except Exception as e:
        log("ERROR", f"Ошибка при блокировке пользователя {user_id}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Failed to block user.")

@router.post("/user/{user_id}/unblock", response_class=CustomJSONResponse)
async def unblock_user(user_id: int):
    """Снимает блокировку с пользователя и сбрасывает его счетчик спама."""
    try:
        # Сначала меняем статус
        await database.update_user_status(user_id, 'active')
        # Затем "прощаем" прошлые нарушения, чтобы его не заблокировало снова
        await database.forgive_spam_strikes(user_id)
        return {"status": "ok", "message": f"User {user_id} unblocked and strikes forgiven."}
    except Exception as e:
        log("ERROR", f"Ошибка при разблокировке пользователя {user_id}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Failed to unblock user.")

@router.delete("/user/{user_id}", response_class=CustomJSONResponse)
async def delete_user_by_admin(user_id: int):
    """Удаляет пользователя и все связанные с ним данные."""
    try:
        await database.delete_user(user_id)
        return {"status": "ok", "message": f"User {user_id} deleted."}
    except Exception as e:
        log("ERROR", f"Ошибка при удалении пользователя {user_id}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Failed to delete user.")