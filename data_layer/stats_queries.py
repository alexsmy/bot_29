
import asyncpg

from data_layer.pool_manager import get_pool

async def get_stats(period: str):
    """
    Собирает и возвращает статистику по приложению за указанный период.
    """
    query_parts = {
        "day": "WHERE first_seen >= NOW() - INTERVAL '1 day'",
        "week": "WHERE first_seen >= NOW() - INTERVAL '7 days'",
        "month": "WHERE first_seen >= NOW() - INTERVAL '30 days'",
        "all": ""
    }
    date_filter = query_parts.get(period, "")
    pool = await get_pool()
    async with pool.acquire() as conn:
        total_users = await conn.fetchval(f"SELECT COUNT(*) FROM users {date_filter}")
        total_actions = await conn.fetchval("SELECT COUNT(*) FROM bot_actions")
        total_sessions = await conn.fetchval("SELECT COUNT(*) FROM call_sessions")
        completed_calls_data = await conn.fetchrow("SELECT COUNT(*) as count, AVG(duration_seconds) as avg_duration FROM call_history WHERE duration_seconds IS NOT NULL")
        active_rooms_count = await conn.fetchval("SELECT COUNT(*) FROM call_sessions WHERE expires_at > NOW() AND closed_at IS NULL")
        return {
            "total_users": total_users or 0,
            "total_actions": total_actions or 0,
            "total_sessions_created": total_sessions or 0,
            "completed_calls": completed_calls_data['count'] or 0,
            "avg_call_duration": round(completed_calls_data['avg_duration'] or 0),
            "active_rooms_count": active_rooms_count or 0
        }