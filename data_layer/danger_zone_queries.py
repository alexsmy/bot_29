
import asyncpg
import logging

from configurable_logger import log
from data_layer.pool_manager import get_pool

async def clear_all_data():
    """
    Полностью очищает все таблицы в базе данных.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("TRUNCATE TABLE call_history, connections, bot_actions, call_sessions, users, admin_tokens RESTART IDENTITY CASCADE")
        log("ADMIN_ACTION", "Все таблицы базы данных были полностью очищены.", level=logging.WARNING)