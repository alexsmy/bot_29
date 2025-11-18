import asyncpg
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from configurable_logger import log
from data_layer.pool_manager import get_pool

async def log_user(user_id: int, first_name: str, last_name: str, username: str):
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

async def get_users_info() -> List[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_id, first_name, last_name, username, first_seen, status FROM users ORDER BY first_seen DESC")
        return [dict(row) for row in rows]

async def get_user_status(user_id: int) -> Optional[str]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        status = await conn.fetchval("SELECT status FROM users WHERE user_id = $1", user_id)
        return status

async def update_user_status(user_id: int, status: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET status = $1 WHERE user_id = $2", status, user_id)
    log("DB_LIFECYCLE", f"Статус пользователя {user_id} изменен на '{status}'.")

async def delete_user(user_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM users WHERE user_id = $1", user_id)
    log("ADMIN_ACTION", f"Пользователь {user_id} и все его данные были удалены администратором.", level="WARNING")

async def import_users_and_actions(data: Dict[str, List[Dict[str, Any]]]):
    pool = await get_pool()
    users = data.get('users', [])
    actions = data.get('actions', [])
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            if users:
                await conn.executemany(
                    """
                    INSERT INTO users (user_id, first_name, last_name, username, first_seen, status)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (user_id) DO NOTHING
                    """,
                    [(u['user_id'], u['first_name'], u['last_name'], u['username'], u['first_seen'], u['status']) for u in users]
                )
            
            if actions:
                await conn.executemany(
                    """
                    INSERT INTO bot_actions (user_id, action, timestamp)
                    VALUES ($1, $2, $3)
                    """,
                    [(a['user_id'], a['action'], a['timestamp']) for a in actions]
                )
    log("ADMIN_ACTION", f"Импортировано {len(users)} пользователей и {len(actions)} действий из файла.")

async def get_all_actions() -> List[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_id, action, timestamp FROM bot_actions")
        return [dict(row) for row in rows]