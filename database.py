# database.py

import asyncpg
import os
from datetime import datetime, timedelta, date, timezone
from typing import Dict, Any, List
from logger_config import logger
from config import ADMIN_TOKEN_LIFETIME_MINUTES

pool = None

async def get_pool():
    global pool
    if pool is None:
        try:
            pool = await asyncpg.create_pool(
                user=os.environ.get('DB_USER'),
                password=os.environ.get('DB_PASSWORD'),
                database=os.environ.get('DB_NAME'),
                host=os.environ.get('DB_HOST'),
                port=os.environ.get('DB_PORT')
            )
            logger.info("Пул соединений с базой данных успешно создан.")
        except Exception as e:
            logger.critical(f"Не удалось создать пул соединений с БД: {e}")
            raise
    return pool

async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None
        logger.info("Пул соединений с базой данных закрыт.")

async def init_db():
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                first_seen TIMESTAMPTZ DEFAULT NOW()
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS bot_actions (
                id SERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id),
                action TEXT NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS call_sessions (
                id SERIAL PRIMARY KEY,
                room_id TEXT UNIQUE NOT NULL,
                creator_user_id BIGINT REFERENCES users(user_id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                status TEXT DEFAULT 'active',
                closed_at TIMESTAMPTZ,
                close_reason TEXT
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS connections (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
                server_user_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                country TEXT,
                city TEXT,
                device_type TEXT,
                os_info TEXT,
                browser_info TEXT,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS call_events (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
                participant1_conn_id INTEGER REFERENCES connections(id) ON DELETE SET NULL,
                participant2_conn_id INTEGER REFERENCES connections(id) ON DELETE SET NULL,
                call_type TEXT,
                start_time TIMESTAMPTZ DEFAULT NOW(),
                end_time TIMESTAMPTZ,
                duration_seconds INTEGER,
                connection_type TEXT
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS admin_tokens (
                id SERIAL PRIMARY KEY,
                token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS admin_settings (
                key TEXT PRIMARY KEY,
                value JSONB
            );
        ''')
        logger.info("Проверка и инициализация таблиц БД завершена.")

async def log_user(user_id: int, first_name: str, last_name: str, username: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            INSERT INTO users (user_id, first_name, last_name, username)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                username = EXCLUDED.username;
        ''', user_id, first_name, last_name, username)

async def log_bot_action(user_id: int, action: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            INSERT INTO bot_actions (user_id, action) VALUES ($1, $2);
        ''', user_id, action)

async def log_call_session(room_id: str, user_id: int, created_at: datetime, expires_at: datetime):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            INSERT INTO call_sessions (room_id, creator_user_id, created_at, expires_at)
            VALUES ($1, $2, $3, $4);
        ''', room_id, user_id, created_at, expires_at)

async def log_connection(room_id: str, server_user_id: str, ip_address: str, user_agent: str, parsed_data: dict) -> int:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        session_id = await connection.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', room_id)
        if session_id:
            return await connection.fetchval('''
                INSERT INTO connections (session_id, server_user_id, ip_address, user_agent, country, city, device_type, os_info, browser_info)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;
            ''', session_id, server_user_id, ip_address, user_agent, parsed_data.get('country'), parsed_data.get('city'),
                parsed_data.get('device'), parsed_data.get('os'), parsed_data.get('browser'))
    return 0

async def log_call_initiated(room_id: str, call_type: str, p1_conn_id: int, p2_conn_id: int):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        session_id = await connection.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', room_id)
        if session_id:
            await connection.execute('''
                INSERT INTO call_events (session_id, call_type, participant1_conn_id, participant2_conn_id)
                VALUES ($1, $2, $3, $4);
            ''', session_id, call_type, p1_conn_id, p2_conn_id)

async def log_connection_established(room_id: str, connection_type: str) -> bool:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        session_id = await connection.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', room_id)
        if session_id:
            result = await connection.execute('''
                UPDATE call_events
                SET connection_type = $1
                WHERE id = (
                    SELECT id FROM call_events
                    WHERE session_id = $2 AND connection_type IS NULL
                    ORDER BY start_time DESC
                    LIMIT 1
                ) AND connection_type IS NULL;
            ''', connection_type, session_id)
            return result.strip() == "UPDATE 1"
    return False

async def log_call_end(room_id: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        session_id = await connection.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', room_id)
        if session_id:
            await connection.execute('''
                UPDATE call_events
                SET end_time = NOW(),
                    duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER
                WHERE id = (
                    SELECT id FROM call_events
                    WHERE session_id = $1 AND end_time IS NULL
                    ORDER BY start_time DESC
                    LIMIT 1
                );
            ''', session_id)

async def log_room_closure(room_id: str, reason: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            UPDATE call_sessions
            SET status = 'closed', closed_at = NOW(), close_reason = $2
            WHERE room_id = $1 AND status = 'active';
        ''', room_id, reason)

async def get_call_session_details(room_id: str) -> dict:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        return await connection.fetchrow(
            'SELECT * FROM call_sessions WHERE room_id = $1 AND expires_at > NOW() AND status = \'active\'',
            room_id
        )

async def get_room_lifetime_hours(room_id: str) -> int:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        record = await connection.fetchrow(
            'SELECT created_at, expires_at FROM call_sessions WHERE room_id = $1',
            room_id
        )
        if record:
            lifetime_seconds = (record['expires_at'] - record['created_at']).total_seconds()
            return round(lifetime_seconds / 3600)
    return 3

async def get_stats(period: str = "all") -> Dict[str, Any]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        interval_filter = ""
        if period == "day":
            interval_filter = "WHERE timestamp >= NOW() - interval '1 day'"
        elif period == "week":
            interval_filter = "WHERE timestamp >= NOW() - interval '7 days'"
        elif period == "month":
            interval_filter = "WHERE timestamp >= NOW() - interval '1 month'"

        total_users = await connection.fetchval("SELECT COUNT(*) FROM users;")
        total_actions = await connection.fetchval(f"SELECT COUNT(*) FROM bot_actions {interval_filter.replace('timestamp', 'bot_actions.timestamp')};")
        total_sessions_created = await connection.fetchval(f"SELECT COUNT(*) FROM call_sessions {interval_filter.replace('timestamp', 'created_at')};")
        
        call_stats_filter = interval_filter.replace('timestamp', 'start_time')
        completed_calls = await connection.fetchval(f"SELECT COUNT(*) FROM call_events WHERE duration_seconds IS NOT NULL {call_stats_filter.replace('WHERE', 'AND') if call_stats_filter else ''};")
        avg_call_duration = await connection.fetchval(f"SELECT AVG(duration_seconds) FROM call_events WHERE duration_seconds IS NOT NULL {call_stats_filter.replace('WHERE', 'AND') if call_stats_filter else ''};")
        
        active_rooms_count = await connection.fetchval("SELECT COUNT(*) FROM call_sessions WHERE status = 'active' AND expires_at > NOW();")

        return {
            "total_users": total_users or 0,
            "total_actions": total_actions or 0,
            "total_sessions_created": total_sessions_created or 0,
            "completed_calls": completed_calls or 0,
            "avg_call_duration": round(avg_call_duration) if avg_call_duration else 0,
            "active_rooms_count": active_rooms_count or 0,
        }

async def get_users_info() -> List[Dict[str, Any]]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        rows = await connection.fetch("SELECT user_id, first_name, last_name, username, first_seen FROM users ORDER BY first_seen DESC;")
        return [dict(row) for row in rows]

async def get_user_actions(user_id: int) -> List[Dict[str, Any]]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        rows = await connection.fetch("SELECT action, timestamp FROM bot_actions WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 20;", user_id)
        return [dict(row) for row in rows]

async def get_connections_info(query_date: date) -> List[Dict[str, Any]]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        rows = await connection.fetch('''
            WITH session_calls AS (
                SELECT
                    ce.session_id,
                    json_agg(
                        json_build_object(
                            'call_type', ce.call_type,
                            'start_time', ce.start_time,
                            'duration_seconds', ce.duration_seconds,
                            'connection_type', ce.connection_type,
                            'participants', (
                                SELECT json_agg(
                                    json_build_object(
                                        'ip_address', c.ip_address,
                                        'country', c.country,
                                        'city', c.city,
                                        'device_type', c.device_type,
                                        'os_info', c.os_info,
                                        'browser_info', c.browser_info
                                    )
                                )
                                FROM connections c
                                WHERE c.id = ce.participant1_conn_id OR c.id = ce.participant2_conn_id
                            )
                        )
                        ORDER BY ce.start_time
                    ) AS call_groups
                FROM call_events ce
                GROUP BY ce.session_id
            )
            SELECT
                cs.room_id,
                cs.created_at,
                cs.status,
                cs.closed_at,
                cs.close_reason,
                COALESCE(sc.call_groups, '[]'::json) AS call_groups
            FROM call_sessions cs
            LEFT JOIN session_calls sc ON cs.id = sc.session_id
            WHERE cs.created_at::date = $1
            ORDER BY cs.created_at DESC;
        ''', query_date)
        return [dict(row) for row in rows]

async def get_all_active_sessions() -> List[Dict[str, Any]]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        rows = await connection.fetch('''
            SELECT 
                cs.room_id, 
                cs.created_at, 
                cs.expires_at,
                (SELECT call_type FROM call_events WHERE session_id = cs.id ORDER BY start_time DESC LIMIT 1) as call_type,
                (SELECT CASE WHEN end_time IS NULL THEN 'active' ELSE 'completed' END FROM call_events WHERE session_id = cs.id ORDER BY start_time DESC LIMIT 1) as status
            FROM call_sessions cs
            WHERE cs.status = 'active' AND cs.expires_at > NOW()
            ORDER BY cs.created_at DESC;
        ''')
        return [dict(row) for row in rows]

async def add_admin_token(token: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ADMIN_TOKEN_LIFETIME_MINUTES)
        await connection.execute(
            "INSERT INTO admin_tokens (token, expires_at) VALUES ($1, $2)",
            token, expires_at
        )

async def get_admin_token_expiry(token: str) -> datetime | None:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        return await connection.fetchval(
            "SELECT expires_at FROM admin_tokens WHERE token = $1 AND expires_at > NOW()",
            token
        )

async def get_notification_settings() -> Dict[str, bool]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        record = await connection.fetchrow("SELECT value FROM admin_settings WHERE key = 'notifications'")
        if record:
            return record['value']
        return {
            "notify_on_room_creation": False,
            "notify_on_call_start": False,
            "notify_on_call_end": False,
            "send_connection_report": False
        }

async def update_notification_settings(settings: Dict[str, bool]):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            INSERT INTO admin_settings (key, value) VALUES ('notifications', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1;
        ''', settings)

async def clear_all_data():
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute("TRUNCATE TABLE bot_actions, call_events, connections, call_sessions, users, admin_tokens, admin_settings RESTART IDENTITY;")
        logger.warning("Все данные в базе данных были удалены администратором.")