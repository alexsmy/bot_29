# routes/admin/users.py

from fastapi import APIRouter

import database
from core import CustomJSONResponse

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