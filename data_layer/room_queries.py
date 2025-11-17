import asyncpg
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from data_layer.pool_manager import get_pool

async def log_room_closure(room_id: str, reason: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE call_sessions SET closed_at = $1, close_reason = $2, status = 'closed' WHERE room_id = $3 AND closed_at IS NULL",
            datetime.now(timezone.utc), reason, room_id
        )

async def get_room_lifetime_hours(room_id: str) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = "SELECT created_at, expires_at FROM call_sessions WHERE room_id = $1"
        row = await conn.fetchrow(query, room_id)
        if not row:
            from config import PRIVATE_ROOM_LIFETIME_HOURS
            return PRIVATE_ROOM_LIFETIME_HOURS
        
        created_at = row['created_at']
        expires_at = row['expires_at']
        
        lifetime_seconds = (expires_at - created_at).total_seconds()
        return round(lifetime_seconds / 3600)

async def get_all_active_sessions():
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT cs.room_id, cs.created_at, cs.expires_at, cs.status, cs.generated_by_user_id, ch.call_type
            FROM call_sessions cs
            LEFT JOIN (
                SELECT session_id, call_type, ROW_NUMBER() OVER(PARTITION BY session_id ORDER BY call_started_at DESC) as rn
                FROM call_history
            ) ch ON cs.session_id = ch.session_id AND ch.rn = 1
            WHERE cs.expires_at > NOW() AND cs.closed_at IS NULL
            ORDER BY cs.created_at DESC
        """
        rows = await conn.fetch(query)
        return [dict(row) for row in rows]

async def get_active_rooms_by_user(user_id: int) -> List[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT room_id, expires_at FROM call_sessions
            WHERE generated_by_user_id = $1 AND expires_at > NOW() AND closed_at IS NULL
            ORDER BY created_at ASC
            """,
            user_id
        )
        return [dict(row) for row in rows]

async def count_active_rooms_by_user(user_id: int) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM call_sessions
            WHERE generated_by_user_id = $1 AND expires_at > NOW() AND closed_at IS NULL
            """,
            user_id
        )
        return count or 0

async def count_recent_room_creations_by_user(user_id: int) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        time_window = datetime.now(timezone.utc) - timedelta(hours=24)
        count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM call_sessions
            WHERE generated_by_user_id = $1 AND created_at >= $2
            """,
            user_id, time_window
        )
        return count or 0