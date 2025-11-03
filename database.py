import os
import asyncpg
from datetime import datetime, timedelta, date, timezone
from typing import Optional, List, Dict, Any
from logger_config import logger

# --- Глобальные переменные ---
pool = None
DATABASE_URL = os.environ.get("DATABASE_URL")

# --- Управление соединением ---
async def get_pool():
    global pool
    if pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL не установлен в переменных окружения.")
        try:
            pool = await asyncpg.create_pool(DATABASE_URL)
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

# --- Инициализация и структура БД ---
async def init_db():
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                first_seen TIMESTAMPTZ NOT NULL
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS bot_actions (
                id SERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id),
                action TEXT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS call_sessions (
                id SERIAL PRIMARY KEY,
                room_id UUID UNIQUE NOT NULL,
                creator_user_id BIGINT REFERENCES users(user_id),
                created_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                status TEXT DEFAULT 'active',
                closed_at TIMESTAMPTZ,
                close_reason TEXT
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS connections (
                id SERIAL PRIMARY KEY,
                session_id INT REFERENCES call_sessions(id),
                user_id_internal UUID NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                parsed_data JSONB,
                timestamp TIMESTAMPTZ NOT NULL
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS call_events (
                id SERIAL PRIMARY KEY,
                session_id INT REFERENCES call_sessions(id),
                call_type TEXT,
                initiated_at TIMESTAMPTZ NOT NULL,
                start_time TIMESTAMPTZ,
                end_time TIMESTAMPTZ,
                connection_type TEXT
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS call_participants (
                id SERIAL PRIMARY KEY,
                call_event_id INT REFERENCES call_events(id) ON DELETE CASCADE,
                connection_id INT REFERENCES connections(id) ON DELETE CASCADE,
                UNIQUE (call_event_id, connection_id)
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS admin_tokens (
                id SERIAL PRIMARY KEY,
                token UUID UNIQUE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL
            );
        ''')
        await connection.execute('''
            CREATE TABLE IF NOT EXISTS admin_settings (
                key TEXT PRIMARY KEY,
                value BOOLEAN NOT NULL
            );
        ''')
        logger.info("Проверка и инициализация таблиц БД завершена.")

# --- Логирование ---
async def log_user(user_id: int, first_name: str, last_name: Optional[str], username: Optional[str]):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            INSERT INTO users (user_id, first_name, last_name, username, first_seen)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                username = EXCLUDED.username;
        ''', user_id, first_name, last_name, username, datetime.now(timezone.utc))

async def log_bot_action(user_id: int, action: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            INSERT INTO bot_actions (user_id, action, timestamp)
            VALUES ($1, $2, $3);
        ''', user_id, action, datetime.now(timezone.utc))

async def log_call_session(room_id: str, user_id: int, created_at: datetime, expires_at: datetime):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            INSERT INTO call_sessions (room_id, creator_user_id, created_at, expires_at)
            VALUES ($1, $2, $3, $4);
        ''', uuid.UUID(room_id), user_id, created_at, expires_at)

async def log_room_closure(room_id: str, reason: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        await connection.execute('''
            UPDATE call_sessions
            SET status = 'closed', closed_at = $1, close_reason = $2
            WHERE room_id = $3 AND status = 'active';
        ''', datetime.now(timezone.utc), reason, uuid.UUID(room_id))

async def log_connection(room_id: str, user_id_internal: str, ip: str, ua: str, parsed_data: dict):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        session_id = await connection.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', uuid.UUID(room_id))
        if session_id:
            await connection.execute('''
                INSERT INTO connections (session_id, user_id_internal, ip_address, user_agent, parsed_data, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6);
            ''', session_id, uuid.UUID(user_id_internal), ip, ua, json.dumps(parsed_data), datetime.now(timezone.utc))

async def log_call_initiated(room_id: str, call_type: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        session_id = await connection.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', uuid.UUID(room_id))
        if session_id:
            await connection.execute('''
                INSERT INTO call_events (session_id, call_type, initiated_at)
                VALUES ($1, $2, $3);
            ''', session_id, call_type, datetime.now(timezone.utc))

async def log_connection_established(room_id: str, connection_type: str, participant_ids: List[str]) -> Optional[int]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        async with connection.transaction():
            session_id = await connection.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', uuid.UUID(room_id))
            if not session_id: return None

            call_event_id = await connection.fetchval('''
                SELECT id FROM call_events
                WHERE session_id = $1 AND start_time IS NULL
                ORDER BY initiated_at DESC
                LIMIT 1;
            ''', session_id)

            if not call_event_id: return None

            await connection.execute('''
                UPDATE call_events
                SET start_time = $1, connection_type = $2
                WHERE id = $3;
            ''', datetime.now(timezone.utc), connection_type, call_event_id)

            for user_id in participant_ids:
                connection_id = await connection.fetchval('''
                    SELECT id FROM connections
                    WHERE session_id = $1 AND user_id_internal = $2
                    ORDER BY timestamp DESC
                    LIMIT 1;
                ''', session_id, uuid.UUID(user_id))
                if connection_id:
                    await connection.execute('''
                        INSERT INTO call_participants (call_event_id, connection_id)
                        VALUES ($1, $2) ON CONFLICT DO NOTHING;
                    ''', call_event_id, connection_id)
            return call_event_id

async def log_call_end(room_id: str) -> Optional[int]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        session_id = await connection.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', uuid.UUID(room_id))
        if not session_id: return None

        record = await connection.fetchrow('''
            UPDATE call_events
            SET end_time = $1
            WHERE session_id = $2 AND start_time IS NOT NULL AND end_time IS NULL
            RETURNING start_time, end_time;
        ''', datetime.now(timezone.utc), session_id)
        
        if record and record['start_time'] and record['end_time']:
            duration = (record['end_time'] - record['start_time']).total_seconds()
            return int(duration)
        return None

# --- Получение данных для админ-панели ---
async def get_connections_info(for_date: date) -> List[Dict[str, Any]]:
    db_pool = await get_pool()
    start_of_day = datetime.combine(for_date, datetime.min.time(), tzinfo=timezone.utc)
    end_of_day = datetime.combine(for_date, datetime.max.time(), tzinfo=timezone.utc)

    async with db_pool.acquire() as connection:
        sessions = await connection.fetch('''
            SELECT id, room_id, created_at, status, closed_at, close_reason
            FROM call_sessions
            WHERE created_at >= $1 AND created_at <= $2
            ORDER BY created_at DESC;
        ''', start_of_day, end_of_day)

        result = []
        for session in sessions:
            session_id = session['id']
            
            call_events = await connection.fetch('''
                SELECT id, call_type, start_time, end_time, connection_type
                FROM call_events
                WHERE session_id = $1 AND start_time IS NOT NULL
                ORDER BY start_time;
            ''', session_id)

            call_groups = []
            for call in call_events:
                duration = None
                if call['end_time']:
                    duration = int((call['end_time'] - call['start_time']).total_seconds())

                participants = await connection.fetch('''
                    SELECT c.ip_address, c.parsed_data
                    FROM call_participants cp
                    JOIN connections c ON cp.connection_id = c.id
                    WHERE cp.call_event_id = $1;
                ''', call['id'])

                call_groups.append({
                    "call_type": call['call_type'],
                    "start_time": call['start_time'],
                    "duration_seconds": duration,
                    "connection_type": call['connection_type'],
                    "participants": [{
                        "ip_address": p['ip_address'],
                        "country": p['parsed_data'].get('country'),
                        "city": p['parsed_data'].get('city'),
                        "device_type": p['parsed_data'].get('device'),
                        "os_info": p['parsed_data'].get('os'),
                        "browser_info": p['parsed_data'].get('browser'),
                    } for p in participants]
                })

            result.append({
                "room_id": str(session['room_id']),
                "created_at": session['created_at'],
                "status": session['status'],
                "closed_at": session['closed_at'],
                "close_reason": session['close_reason'],
                "call_groups": call_groups
            })
    return result

# --- Остальные функции без изменений ---
async def get_stats(period: str):
    db_pool = await get_pool()
    
    interval_map = {
        "day": "1 day",
        "week": "7 days",
        "month": "1 month"
    }
    interval = interval_map.get(period)
    
    time_filter = f"WHERE timestamp >= NOW() - interval '{interval}'" if interval else ""
    session_time_filter = f"WHERE created_at >= NOW() - interval '{interval}'" if interval else ""
    call_time_filter = f"WHERE start_time >= NOW() - interval '{interval}'" if interval else ""

    async with db_pool.acquire() as connection:
        total_users = await connection.fetchval('SELECT COUNT(*) FROM users;')
        total_actions = await connection.fetchval(f'SELECT COUNT(*) FROM bot_actions {time_filter};')
        total_sessions_created = await connection.fetchval(f'SELECT COUNT(*) FROM call_sessions {session_time_filter};')
        
        completed_calls_query = f'''
            SELECT COUNT(*) FROM call_events 
            {call_time_filter} {'AND' if call_time_filter else 'WHERE'} end_time IS NOT NULL;
        '''
        completed_calls = await connection.fetchval(completed_calls_query)

        avg_duration_query = f'''
            SELECT AVG(EXTRACT(EPOCH FROM (end_time - start_time))) 
            FROM call_events 
            {call_time_filter} {'AND' if call_time_filter else 'WHERE'} end_time IS NOT NULL;
        '''
        avg_duration = await connection.fetchval(avg_duration_query) or 0
        
        active_rooms_count = await connection.fetchval("SELECT COUNT(*) FROM call_sessions WHERE status = 'active';")

    return {
        "total_users": total_users,
        "total_actions": total_actions,
        "total_sessions_created": total_sessions_created,
        "completed_calls": completed_calls,
        "avg_call_duration": round(avg_duration, 2),
        "active_rooms_count": active_rooms_count
    }

async def get_users_info():
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        return [dict(row) for row in await connection.fetch('SELECT user_id, first_name, last_name, username, first_seen FROM users ORDER BY first_seen DESC;')]

async def get_user_actions(user_id: int):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        return [dict(row) for row in await connection.fetch('SELECT action, timestamp FROM bot_actions WHERE user_id = $1 ORDER BY timestamp DESC;', user_id)]

async def get_call_session_details(room_id: str):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        return await connection.fetchrow("SELECT * FROM call_sessions WHERE room_id = $1 AND status = 'active'", uuid.UUID(room_id))

async def get_all_active_sessions():
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        return await connection.fetch('''
            SELECT cs.room_id, cs.created_at, cs.expires_at, ce.call_type,
                   CASE WHEN ce.start_time IS NOT NULL AND ce.end_time IS NULL THEN 'active' ELSE 'pending' END as status
            FROM call_sessions cs
            LEFT JOIN (
                SELECT session_id, call_type, start_time, end_time,
                       ROW_NUMBER() OVER(PARTITION BY session_id ORDER BY initiated_at DESC) as rn
                FROM call_events
            ) ce ON cs.id = ce.session_id AND ce.rn = 1
            WHERE cs.status = 'active';
        ''')

async def get_room_lifetime_hours(room_id: str) -> int:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        record = await connection.fetchrow("SELECT created_at, expires_at FROM call_sessions WHERE room_id = $1", uuid.UUID(room_id))
        if record:
            return round((record['expires_at'] - record['created_at']).total_seconds() / 3600)
        return 3

async def add_admin_token(token: str):
    db_pool = await get_pool()
    from config import ADMIN_TOKEN_LIFETIME_MINUTES
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(minutes=ADMIN_TOKEN_LIFETIME_MINUTES)
    async with db_pool.acquire() as connection:
        await connection.execute("INSERT INTO admin_tokens (token, created_at, expires_at) VALUES ($1, $2, $3);", uuid.UUID(token), created_at, expires_at)

async def get_admin_token_expiry(token: str) -> Optional[datetime]:
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        record = await connection.fetchrow("SELECT expires_at FROM admin_tokens WHERE token = $1;", uuid.UUID(token))
        if record and record['expires_at'] > datetime.now(timezone.utc):
            return record['expires_at']
    return None

async def get_notification_settings() -> Dict[str, bool]:
    db_pool = await get_pool()
    defaults = {
        "notify_on_room_creation": False,
        "notify_on_call_start": False,
        "notify_on_call_end": False,
        "send_connection_report": False
    }
    async with db_pool.acquire() as connection:
        records = await connection.fetch("SELECT key, value FROM admin_settings;")
        settings = {r['key']: r['value'] for r in records}
        defaults.update(settings)
    return defaults

async def update_notification_settings(settings: Dict[str, bool]):
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        async with connection.transaction():
            for key, value in settings.items():
                await connection.execute('''
                    INSERT INTO admin_settings (key, value) VALUES ($1, $2)
                    ON CONFLICT (key) DO UPDATE SET value = $2;
                ''', key, value)

async def clear_all_data():
    db_pool = await get_pool()
    async with db_pool.acquire() as connection:
        async with connection.transaction():
            await connection.execute("TRUNCATE TABLE bot_actions, call_participants, call_events, connections, call_sessions, users, admin_tokens, admin_settings RESTART IDENTITY;")
    logger.warning("Все данные в базе данных были удалены администратором.")