import logging
from fastapi import APIRouter, HTTPException

import database
from core import CustomJSONResponse
from configurable_logger import log

router = APIRouter()

@router.get("/users", response_class=CustomJSONResponse)
async def get_admin_users():
    """
    Возвращает список всех пользователей.
    """
    users = await database.get_users_info()
    return users

@router.get("/user_actions/{user_id}", response_class=CustomJSONResponse)
async def get_admin_user_actions(user_id: int):
    """
    Возвращает историю действий для конкретного пользователя.
    """
    actions = await database.get_user_actions(user_id)
    return actions

# --- ИЗМЕНЕННЫЕ ЭНДПОИНТЫ ---

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