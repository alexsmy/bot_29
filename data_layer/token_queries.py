
import asyncpg
from datetime import datetime, timezone, timedelta
from typing import Optional

from data_layer.pool_manager import get_pool
from config import ADMIN_TOKEN_LIFETIME_MINUTES

async def add_admin_token(token: str):
    """
    Добавляет новый токен администратора в БД с указанным временем жизни.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=ADMIN_TOKEN_LIFETIME_MINUTES)
        await conn.execute(
            "INSERT INTO admin_tokens (token, expires_at) VALUES ($1, $2)",
            token, expiry_time
        )

async def get_admin_token_expiry(token: str) -> Optional[datetime]:
    """
    Проверяет токен администратора, удаляя истекшие, и возвращает время его жизни.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM admin_tokens WHERE expires_at < $1", datetime.now(timezone.utc))
        row = await conn.fetchrow("SELECT expires_at FROM admin_tokens WHERE token = $1", token)
        return row['expires_at'] if row else None