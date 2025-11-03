# database.py

import os
import asyncpg
from datetime import datetime, timedelta, date, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from logger_config import logger
from config import ADMIN_TOKEN_LIFETIME_MINUTES

pool = None

class User(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None

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
            logger.critical(f"Не удалось подключиться к базе данных: {e}")
            raise
    return pool

async def close_pool():
    global pool
    if pool:
        await pool.close()
        logger.info("Пул соединений с базой данных закрыт.")

async def init_db():
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                first_seen TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS bot_actions (
                id SERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id),
                action TEXT,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS call_sessions (
                id SERIAL PRIMARY KEY,
                room_id UUID UNIQUE NOT NULL,
                initiator_user_id BIGINT REFERENCES users(user_id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                closed_at TIMESTAMPTZ,
                close_reason TEXT
            );
            CREATE TABLE IF NOT EXISTS connections (
                id SERIAL PRIMARY KEY,
                room_id UUID REFERENCES call_sessions(room_id) ON DELETE CASCADE,
                ip_address TEXT,
                user_agent_string TEXT,
                parsed_data JSONB,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS call_groups (
                id SERIAL PRIMARY KEY,
                room_id UUID REFERENCES call_sessions(room_id) ON DELETE CASCADE,
                call_type VARCHAR(10),
                start_time TIMESTAMPTZ DEFAULT NOW(),
                end_time TIMESTAMPTZ,
                duration_seconds INTEGER,
                connection_type VARCHAR(10)
            );
            CREATE TABLE IF NOT EXISTS admin_tokens (
                id SERIAL PRIMARY KEY,
                token UUID UNIQUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE IF NOT EXISTS admin_settings (
                key VARCHAR(50) PRIMARY KEY,
                value BOOLEAN NOT NULL
            );
        ''')
        logger.info("Проверка и инициализация таблиц в БД завершена.")
    finally:
        await (await get_pool()).release(conn)

async def log_user(user_id: int, first_name: str, last_name: str, username: str):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('''
            INSERT INTO users (user_id, first_name, last_name, username)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                username = EXCLUDED.username;
        ''', user_id, first_name, last_name, username)
    finally:
        await (await get_pool()).release(conn)

async def log_bot_action(user_id: int, action: str):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('INSERT INTO bot_actions (user_id, action) VALUES ($1, $2)', user_id, action)
    finally:
        await (await get_pool()).release(conn)

async def log_call_session(room_id: str, user_id: int, created_at: datetime, expires_at: datetime):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute(
            'INSERT INTO call_sessions (room_id, initiator_user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
            uuid.UUID(room_id), user_id, created_at, expires_at
        )
    finally:
        await (await get_pool()).release(conn)

async def get_call_session_details(room_id: str):
    conn = await (await get_pool()).acquire()
    try:
        return await conn.fetchrow('SELECT * FROM call_sessions WHERE room_id = $1 AND status = $2', uuid.UUID(room_id), 'active')
    finally:
        await (await get_pool()).release(conn)

async def get_all_active_sessions():
    conn = await (await get_pool()).acquire()
    try:
        query = """
            SELECT 
                cs.room_id, 
                cs.created_at, 
                cs.expires_at,
                (SELECT call_type FROM call_groups WHERE room_id = cs.room_id ORDER BY start_time DESC LIMIT 1) as call_type,
                CASE 
                    WHEN (SELECT COUNT(*) FROM call_groups WHERE room_id = cs.room_id AND end_time IS NULL) > 0 THEN 'active'
                    ELSE 'pending'
                END as status
            FROM call_sessions cs
            WHERE cs.status = 'active'
        """
        return await conn.fetch(query)
    finally:
        await (await get_pool()).release(conn)

async def log_room_closure(room_id: str, reason: str):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute(
            "UPDATE call_sessions SET status = 'closed', closed_at = NOW(), close_reason = $1 WHERE room_id = $2",
            reason, uuid.UUID(room_id)
        )
    finally:
        await (await get_pool()).release(conn)

async def log_connection(room_id: str, ip_address: str, user_agent: str, parsed_data: dict):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute(
            'INSERT INTO connections (room_id, ip_address, user_agent_string, parsed_data) VALUES ($1, $2, $3, $4)',
            uuid.UUID(room_id), ip_address, user_agent, parsed_data
        )
    finally:
        await (await get_pool()).release(conn)

async def log_call_initiated(room_id: str, call_type: str):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute(
            'INSERT INTO call_groups (room_id, call_type) VALUES ($1, $2)',
            uuid.UUID(room_id), call_type
        )
    finally:
        await (await get_pool()).release(conn)

async def log_connection_established(room_id: str, connection_type: str) -> bool:
    conn = await (await get_pool()).acquire()
    try:
        # Обновляем только последнюю запись о звонке для этой комнаты, у которой еще нет типа соединения
        result = await conn.execute('''
            UPDATE call_groups
            SET connection_type = $1
            WHERE id = (
                SELECT id FROM call_groups
                WHERE room_id = $2 AND connection_type IS NULL
                ORDER BY start_time DESC
                LIMIT 1
            )
        ''', connection_type, uuid.UUID(room_id))
        # result в формате 'UPDATE N', где N - количество обновленных строк
        return result != 'UPDATE 0'
    finally:
        await (await get_pool()).release(conn)

async def log_call_end(room_id: str):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('''
            UPDATE call_groups
            SET end_time = NOW(),
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER
            WHERE id = (
                SELECT id FROM call_groups
                WHERE room_id = $1 AND end_time IS NULL
                ORDER BY start_time DESC
                LIMIT 1
            )
        ''', uuid.UUID(room_id))
    finally:
        await (await get_pool()).release(conn)

async def get_room_lifetime_hours(room_id: str) -> int:
    conn = await (await get_pool()).acquire()
    try:
        record = await conn.fetchrow(
            "SELECT EXTRACT(EPOCH FROM (expires_at - created_at))/3600 AS lifetime FROM call_sessions WHERE room_id = $1",
            uuid.UUID(room_id)
        )
        return int(record['lifetime']) if record else 3
    finally:
        await (await get_pool()).release(conn)

async def add_admin_token(token: str):
    conn = await (await get_pool()).acquire()
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ADMIN_TOKEN_LIFETIME_MINUTES)
        await conn.execute(
            'INSERT INTO admin_tokens (token, expires_at) VALUES ($1, $2)',
            uuid.UUID(token), expires_at
        )
    finally:
        await (await get_pool()).release(conn)

async def get_admin_token_expiry(token: str) -> Optional[datetime]:
    conn = await (await get_pool()).acquire()
    try:
        record = await conn.fetchrow(
            'SELECT expires_at FROM admin_tokens WHERE token = $1 AND expires_at > NOW()',
            uuid.UUID(token)
        )
        return record['expires_at'] if record else None
    finally:
        await (await get_pool()).release(conn)

async def get_stats(period: str):
    conn = await (await get_pool()).acquire()
    try:
        interval_map = {
            "day": "1 day",
            "week": "7 days",
            "month": "1 month"
        }
        interval = interval_map.get(period)
        
        where_clause = f"WHERE timestamp >= NOW() - interval '{interval}'" if interval else ""

        total_users = await conn.fetchval('SELECT COUNT(*) FROM users')
        total_actions = await conn.fetchval(f'SELECT COUNT(*) FROM bot_actions {where_clause.replace("timestamp", "bot_actions.timestamp")}')
        total_sessions_created = await conn.fetchval(f'SELECT COUNT(*) FROM call_sessions {where_clause.replace("timestamp", "created_at")}')
        
        call_where_clause = where_clause.replace("timestamp", "start_time")
        completed_calls = await conn.fetchval(f'SELECT COUNT(*) FROM call_groups WHERE duration_seconds IS NOT NULL {call_where_clause.replace("WHERE", "AND") if call_where_clause else ""}')
        avg_call_duration = await conn.fetchval(f'SELECT COALESCE(AVG(duration_seconds), 0)::INTEGER FROM call_groups WHERE duration_seconds IS NOT NULL {call_where_clause.replace("WHERE", "AND") if call_where_clause else ""}')
        
        active_rooms_count = await conn.fetchval("SELECT COUNT(*) FROM call_sessions WHERE status = 'active'")

        return {
            "total_users": total_users,
            "total_actions": total_actions,
            "total_sessions_created": total_sessions_created,
            "completed_calls": completed_calls,
            "avg_call_duration": avg_call_duration,
            "active_rooms_count": active_rooms_count
        }
    finally:
        await (await get_pool()).release(conn)

async def get_users_info():
    conn = await (await get_pool()).acquire()
    try:
        return await conn.fetch('SELECT user_id, first_name, last_name, username, first_seen FROM users ORDER BY first_seen DESC')
    finally:
        await (await get_pool()).release(conn)

async def get_user_actions(user_id: int):
    conn = await (await get_pool()).acquire()
    try:
        return await conn.fetch('SELECT action, timestamp FROM bot_actions WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 10', user_id)
    finally:
        await (await get_pool()).release(conn)

async def get_connections_info(query_date: date):
    conn = await (await get_pool()).acquire()
    try:
        start_of_day = datetime.combine(query_date, datetime.min.time(), tzinfo=timezone.utc)
        end_of_day = datetime.combine(query_date, datetime.max.time(), tzinfo=timezone.utc)

        sessions = await conn.fetch(
            """
            SELECT room_id, created_at, closed_at, close_reason, status
            FROM call_sessions
            WHERE created_at >= $1 AND created_at <= $2
            ORDER BY created_at DESC
            """,
            start_of_day, end_of_day
        )

        result = []
        for session in sessions:
            session_dict = dict(session)
            
            call_groups = await conn.fetch(
                """
                SELECT id, call_type, start_time, end_time, duration_seconds, connection_type
                FROM call_groups
                WHERE room_id = $1
                ORDER BY start_time ASC
                """,
                session['room_id']
            )
            
            session_dict['call_groups'] = []
            for call in call_groups:
                call_dict = dict(call)
                
                # Для каждого звонка ищем двух последних уникальных участников до его начала
                participants = await conn.fetch(
                    """
                    WITH ranked_connections AS (
                        SELECT
                            ip_address,
                            parsed_data,
                            ROW_NUMBER() OVER(PARTITION BY ip_address, user_agent_string ORDER BY timestamp DESC) as rn
                        FROM connections
                        WHERE room_id = $1 AND timestamp < $2
                    )
                    SELECT 
                        rc.ip_address,
                        rc.parsed_data ->> 'country' as country,
                        rc.parsed_data ->> 'city' as city,
                        rc.parsed_data ->> 'device' as device_type,
                        rc.parsed_data ->> 'os' as os_info,
                        rc.parsed_data ->> 'browser' as browser_info
                    FROM ranked_connections rc
                    WHERE rc.rn = 1
                    ORDER BY (SELECT MAX(timestamp) FROM connections c WHERE c.ip_address = rc.ip_address AND c.user_agent_string = (rc.parsed_data->>'browser' || ' ' || rc.parsed_data->>'os')) DESC
                    LIMIT 2;
                    """,
                    session['room_id'], call['start_time']
                )
                
                call_dict['participants'] = [dict(p) for p in participants]
                session_dict['call_groups'].append(call_dict)

            result.append(session_dict)
            
        return result
    finally:
        await (await get_pool()).release(conn)

async def get_notification_settings() -> Dict[str, bool]:
    conn = await (await get_pool()).acquire()
    try:
        records = await conn.fetch('SELECT key, value FROM admin_settings')
        return {r['key']: r['value'] for r in records}
    finally:
        await (await get_pool()).release(conn)

async def update_notification_settings(settings: Dict[str, bool]):
    conn = await (await get_pool()).acquire()
    try:
        async with conn.transaction():
            for key, value in settings.items():
                await conn.execute('''
                    INSERT INTO admin_settings (key, value) VALUES ($1, $2)
                    ON CONFLICT (key) DO UPDATE SET value = $2
                ''', key, value)
    finally:
        await (await get_pool()).release(conn)

async def clear_all_data():
    conn = await (await get_pool()).acquire()
    try:
        async with conn.transaction():
            await conn.execute('TRUNCATE bot_actions, connections, call_groups, call_sessions, users, admin_tokens, admin_settings RESTART IDENTITY')
        logger.warning("Все данные в базе данных были удалены администратором.")
    finally:
        await (await get_pool()).release(conn)