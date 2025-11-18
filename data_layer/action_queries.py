
import asyncpg
from datetime import datetime, timezone, timedelta

from data_layer.pool_manager import get_pool
from config import SPAM_TIME_WINDOW_MINUTES
from configurable_logger import log

async def log_bot_action(user_id: int, action: str):
    """
    Логирует действие пользователя в боте.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO bot_actions (user_id, action, timestamp) VALUES ($1, $2, $3)",
            user_id, action, datetime.now(timezone.utc)
        )

async def get_user_actions(user_id: int):
    """
    Возвращает историю действий для конкретного пользователя.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT action, timestamp FROM bot_actions WHERE user_id = $1 ORDER BY timestamp DESC", user_id)
        return [dict(row) for row in rows]

async def count_spam_strikes(user_id: int) -> int:
    """
    Подсчитывает количество спам-действий пользователя за определенное время.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        time_window = datetime.now(timezone.utc) - timedelta(minutes=SPAM_TIME_WINDOW_MINUTES)
        spam_actions = ('Sent unhandled text message', 'Sent an attachment', 'Exceeded daily room creation limit')
        
        count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM bot_actions
            WHERE user_id = $1 AND action = ANY($2::text[]) AND timestamp >= $3
            """,
            user_id, spam_actions, time_window
        )
        return count or 0

async def forgive_spam_strikes(user_id: int):
    """
    "Прощает" спам-действия пользователя, сдвигая их временные метки в прошлое,
    чтобы сбросить счетчик спама.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        new_timestamp = datetime.now(timezone.utc) - timedelta(minutes=SPAM_TIME_WINDOW_MINUTES + 1)
        spam_actions = ('Sent unhandled text message', 'Sent an attachment', 'Exceeded daily room creation limit')
        
        await conn.execute(
            """
            UPDATE bot_actions
            SET timestamp = $1
            WHERE user_id = $2 AND action = ANY($3::text[])
            """,
            new_timestamp, user_id, spam_actions
        )
        log("ADMIN_ACTION", f"Счетчик спама для пользователя {user_id} был сброшен.")