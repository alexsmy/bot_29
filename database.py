# database.py

import os
import asyncpg
from datetime import datetime, date, timezone, timedelta
from typing import Dict, Optional, List, Any
from logger_config import logger
from config import ADMIN_TOKEN_LIFETIME_MINUTES

DATABASE_URL = os.environ.get("DATABASE_URL")
_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL не установлена в переменных окружения")
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        logger.info("Пул соединений с базой данных успешно создан.")
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Пул соединений с базой данных закрыт.")

async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                first_seen TIMESTAMPTZ NOT NULL
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS bot_actions (
                action_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                action TEXT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS call_sessions (
                session_id SERIAL PRIMARY KEY,
                room_id TEXT NOT NULL UNIQUE,
                generated_by_user_id BIGINT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                status TEXT DEFAULT 'pending',
                closed_at TIMESTAMPTZ,
                close_reason TEXT
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS call_events (
                event_id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES call_sessions(session_id) ON DELETE CASCADE,
                call_started_at TIMESTAMPTZ NOT NULL,
                call_ended_at TIMESTAMPTZ,
                duration_seconds INTEGER,
                call_type TEXT,
                connection_type TEXT
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS connections (
                connection_id SERIAL PRIMARY KEY,
                room_id TEXT NOT NULL,
                connected_at TIMESTAMPTZ NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                device_type TEXT,
                os_info TEXT,
                browser_info TEXT,
                country TEXT,
                city TEXT
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS admin_tokens (
                token TEXT PRIMARY KEY,
                expires_at TIMESTAMPTZ NOT NULL
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS admin_settings (
                key TEXT PRIMARY KEY,
                value BOOLEAN NOT NULL
            )
        ''')
        await conn.execute('''
            INSERT INTO admin_settings (key, value) VALUES
            ('notify_on_room_creation', TRUE),
            ('notify_on_call_start', TRUE),
            ('notify_on_call_end', TRUE),
            ('send_connection_report', TRUE)
            ON CONFLICT(key) DO NOTHING
        ''')
    logger.info("База данных PostgreSQL успешно инициализирована.")

async def log_user(user_id, first_name, last_name, username):
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

async def log_bot_action(user_id, action):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO bot_actions (user_id, action, timestamp) VALUES ($1, $2, $3)",
            user_id, action, datetime.now(timezone.utc)
        )

async def log_call_session(room_id, user_id, created_at, expires_at):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO call_sessions (room_id, generated_by_user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
            room_id, user_id, created_at, expires_at
        )

async def log_connection(room_id, ip_address, user_agent, parsed_data):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO connections (
                room_id, connected_at, ip_address, user_agent,
                device_type, os_info, browser_info, country, city
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            room_id, datetime.now(timezone.utc), ip_address, user_agent,
            parsed_data['device'], parsed_data['os'], parsed_data['browser'],
            parsed_data['country'], parsed_data['city']
        )

async def log_call_event_start(room_id: str, call_type: str) -> Optional[int]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        session_id = await conn.fetchval("SELECT session_id FROM call_sessions WHERE room_id = $1", room_id)
        if not session_id:
            return None
        
        await conn.execute("UPDATE call_sessions SET status = 'active' WHERE session_id = $1", session_id)
        
        event_id = await conn.fetchval(
            "INSERT INTO call_events (session_id, call_started_at, call_type) VALUES ($1, $2, $3) RETURNING event_id",
            session_id, datetime.now(timezone.utc), call_type
        )
        return event_id

async def log_call_event_end(event_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT call_started_at FROM call_events WHERE event_id = $1", event_id)
        if row and row['call_started_at']:
            start_time = row['call_started_at']
            end_time = datetime.now(timezone.utc)
            duration = int((end_time - start_time).total_seconds())
            await conn.execute(
                "UPDATE call_events SET call_ended_at = $1, duration_seconds = $2 WHERE event_id = $3",
                end_time, duration, event_id
            )
            session_id = await conn.fetchval("SELECT session_id FROM call_events WHERE event_id = $1", event_id)
            await conn.execute("UPDATE call_sessions SET status = 'completed' WHERE session_id = $1", session_id)

async def log_call_event_connection_type(event_id: int, connection_type: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE call_events SET connection_type = $1 WHERE event_id = $2",
            connection_type, event_id
        )

async def log_room_closure(room_id, reason):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE call_sessions SET closed_at = $1, close_reason = $2, status = 'closed' WHERE room_id = $3 AND closed_at IS NULL",
            datetime.now(timezone.utc), reason, room_id
        )

async def add_admin_token(token: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=ADMIN_TOKEN_LIFETIME_MINUTES)
        await conn.execute(
            "INSERT INTO admin_tokens (token, expires_at) VALUES ($1, $2)",
            token, expiry_time
        )

async def get_admin_token_expiry(token: str) -> Optional[datetime]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM admin_tokens WHERE expires_at < $1", datetime.now(timezone.utc))
        row = await conn.fetchrow("SELECT expires_at FROM admin_tokens WHERE token = $1", token)
        return row['expires_at'] if row else None

async def get_stats(period):
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
        completed_calls_data = await conn.fetchrow("SELECT COUNT(*) as count, AVG(duration_seconds) as avg_duration FROM call_events")
        active_rooms_count = await conn.fetchval("SELECT COUNT(*) FROM call_sessions WHERE expires_at > NOW() AND closed_at IS NULL")
        return {
            "total_users": total_users or 0,
            "total_actions": total_actions or 0,
            "total_sessions_created": total_sessions or 0,
            "completed_calls": completed_calls_data['count'] or 0,
            "avg_call_duration": round(completed_calls_data['avg_duration'] or 0),
            "active_rooms_count": active_rooms_count or 0
        }

async def get_users_info():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_id, first_name, last_name, username, first_seen FROM users ORDER BY first_seen DESC")
        return [dict(row) for row in rows]

async def get_user_actions(user_id):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT action, timestamp FROM bot_actions WHERE user_id = $1 ORDER BY timestamp DESC", user_id)
        return [dict(row) for row in rows]

async def get_connections_info(date_obj: date):
    pool = await get_pool()
    async with pool.acquire() as conn:
        sessions = await conn.fetch(
            "SELECT session_id, room_id, created_at, status, closed_at, close_reason FROM call_sessions WHERE date(created_at AT TIME ZONE 'UTC') = $1 ORDER BY created_at DESC",
            date_obj
        )
        results = []
        for session in sessions:
            session_dict = dict(session)
            
            call_events = await conn.fetch(
                "SELECT * FROM call_events WHERE session_id = $1 ORDER BY call_started_at",
                session_dict['session_id']
            )
            
            session_dict['call_events'] = []
            for event in call_events:
                event_dict = dict(event)
                
                # Находим участников, которые подключились незадолго до начала звонка
                start_time = event_dict['call_started_at']
                end_time = event_dict['call_ended_at'] or (start_time + timedelta(hours=1)) # Окно для поиска
                
                participants = await conn.fetch(
                    """
                    SELECT connected_at, ip_address, device_type, os_info, browser_info, country, city 
                    FROM connections 
                    WHERE room_id = $1 AND connected_at BETWEEN $2 - interval '30 seconds' AND $3
                    ORDER BY connected_at
                    """,
                    session_dict['room_id'], start_time, end_time
                )
                event_dict['participants'] = [dict(p) for p in participants]
                session_dict['call_events'].append(event_dict)
            
            results.append(session_dict)
        return results

async def get_call_session_details(room_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT room_id, created_at, expires_at
            FROM call_sessions
            WHERE room_id = $1 AND expires_at > NOW() AND closed_at IS NULL
        """
        row = await conn.fetchrow(query, room_id)
        return dict(row) if row else None

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

async def clear_all_data():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("TRUNCATE TABLE admin_tokens, connections, bot_actions, call_events, call_sessions, users, admin_settings RESTART IDENTITY CASCADE")
        logger.warning("Все таблицы базы данных были полностью очищены.")

async def get_all_active_sessions():
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT cs.room_id, cs.created_at, cs.expires_at, cs.status, ce.call_type
            FROM call_sessions cs
            LEFT JOIN (
                SELECT session_id, call_type, ROW_NUMBER() OVER(PARTITION BY session_id ORDER BY call_started_at DESC) as rn
                FROM call_events
            ) ce ON cs.session_id = ce.session_id AND ce.rn = 1
            WHERE cs.expires_at > NOW() AND cs.closed_at IS NULL
            ORDER BY cs.created_at DESC
        """
        rows = await conn.fetch(query)
        return [dict(row) for row in rows]

async def get_notification_settings() -> Dict[str, bool]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT key, value FROM admin_settings")
        return {row['key']: row['value'] for row in rows}

async def update_notification_settings(settings: Dict[str, bool]):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for key, value in settings.items():
                await conn.execute(
                    """
                    INSERT INTO admin_settings (key, value) VALUES ($1, $2)
                    ON CONFLICT (key) DO UPDATE SET value = $2
                    """,
                    key, value
                )
        logger.info("Настройки уведомлений администратора обновлены.")