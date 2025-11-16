
import asyncpg
from datetime import datetime, timezone
from typing import Optional

from configurable_logger import log
from data_layer.pool_manager import get_pool

async def log_user(user_id: int, first_name: str, last_name: str, username: str):
    """
    Записывает нового пользователя в БД или игнорирует, если он уже существует.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO users (user_id, first_name, last_name, username, first_seen)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO NOTHING
            """,
            user_id, first_name, last_name, username, datetime.now(timezone.utc)
        )

async def get_users_info():
    """
    Возвращает список всех пользователей из базы данных.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_id, first_name, last_name, username, first_seen, status FROM users ORDER BY first_seen DESC")
        return [dict(row) for row in rows]

async def get_user_status(user_id: int) -> Optional[str]:
    """
    Получает статус пользователя ('active' или 'blocked').
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        status = await conn.fetchval("SELECT status FROM users WHERE user_id = $1", user_id)
        return status

async def update_user_status(user_id: int, status: str):
    """
    Обновляет статус пользователя.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET status = $1 WHERE user_id = $2", status, user_id)
    log("DB_LIFECYCLE", f"Статус пользователя {user_id} изменен на '{status}'.")

async def delete_user(user_id: int):
    """
    Полностью удаляет пользователя и все связанные с ним данные.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM users WHERE user_id = $1", user_id)
    log("ADMIN_ACTION", f"Пользователь {user_id} и все его данные были удалены администратором.", level="WARNING")