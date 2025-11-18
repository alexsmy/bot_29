import asyncpg
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

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

async def import_users_batch(users_data: List[Dict[str, Any]]):
    """
    Массово импортирует пользователей. Если пользователь существует, обновляет его данные.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Подготавливаем данные для executemany
        data_tuples = [
            (
                u['user_id'],
                u.get('first_name'),
                u.get('last_name'),
                u.get('username'),
                u.get('first_seen'), # asyncpg корректно обрабатывает datetime объекты
                u.get('status', 'active')
            )
            for u in users_data
        ]

        query = """
            INSERT INTO users (user_id, first_name, last_name, username, first_seen, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) DO UPDATE
            SET first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                username = EXCLUDED.username,
                first_seen = EXCLUDED.first_seen,
                status = EXCLUDED.status
        """
        
        await conn.executemany(query, data_tuples)
        log("ADMIN_ACTION", f"Импортировано/обновлено {len(users_data)} пользователей.")