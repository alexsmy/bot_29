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
            CREATE TABLE IF NOT EXISTS call_history (
                call_id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES call_sessions(session_id) ON DELETE CASCADE,
                call_type TEXT,
                call_started_at TIMESTAMPTZ NOT NULL,
                call_ended_at TIMESTAMPTZ,
                duration_seconds INTEGER,
                participant1_ip TEXT,
                participant2_ip TEXT,
                connection_type TEXT,
                initiator_ip TEXT
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
        
        # ИЗМЕНЕНИЕ: Создаем таблицу с value TEXT, а не BOOLEAN
        # Если таблица уже существует со старым типом, мы попытаемся изменить тип колонки
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS admin_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        ''')
        
        # Миграция: проверяем тип колонки и меняем при необходимости
        try:
            await conn.execute("ALTER TABLE admin_settings ALTER COLUMN value TYPE TEXT USING value::text")
        except Exception:
            pass # Игнорируем ошибку, если колонка уже TEXT

        # Инициализация настроек по умолчанию
        default_settings = {
            'notify_on_room_creation': 'true',
            'notify_on_call_start': 'true',
            'notify_on_call_end': 'true',
            'send_connection_report': 'true',
            'notify_on_connection_details': 'true',
            'enable_call_recording': 'false',
            # Новые настройки
            'send_audio_recording': 'false',
            'send_transcript': 'false',
            'transcript_mode': 'file', # file или message
            'send_summary': 'false',
            'summary_mode': 'message' # file или message
        }
        
        for key, value in default_settings.items():
            await conn.execute(
                "INSERT INTO admin_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO NOTHING",
                key, value
            )

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

async def log_call_start(room_id: str, call_type: str, p1_ip: Optional[str], p2_ip: Optional[str], initiator_ip: Optional[str]):
    pool = await get_pool()
    async with pool.acquire() as conn:
        session_row = await conn.fetchrow("SELECT session_id FROM call_sessions WHERE room_id = $1", room_id)
        if not session_row:
            logger.error(f"Не удалось найти сессию для room_id {room_id} при старте звонка.")
            return
        session_id = session_row['session_id']

        await conn.execute(
            """
            INSERT INTO call_history (session_id, call_type, call_started_at, participant1_ip, participant2_ip, initiator_ip)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            session_id, call_type, datetime.now(timezone.utc), p1_ip, p2_ip, initiator_ip
        )
        await conn.execute("UPDATE call_sessions SET status = 'active' WHERE session_id = $1", session_id)


async def log_call_end(room_id):
    pool = await get_pool()
    async with pool.acquire() as conn:
        session_row = await conn.fetchrow("SELECT session_id FROM call_sessions WHERE room_id = $1", room_id)
        if not session_row:
            logger.error(f"Не удалось найти сессию для room_id {room_id} при завершении звонка.")
            return
        session_id = session_row['session_id']

        call_row = await conn.fetchrow(
            """
            SELECT call_id, call_started_at FROM call_history
            WHERE session_id = $1 AND call_ended_at IS NULL
            ORDER BY call_started_at DESC LIMIT 1
            """,
            session_id
        )

        if call_row:
            start_time = call_row['call_started_at']
            end_time = datetime.now(timezone.utc)
            duration = int((end_time - start_time).total_seconds())
            
            await conn.execute(
                "UPDATE call_history SET call_ended_at = $1, duration_seconds = $2 WHERE call_id = $3",
                end_time, duration, call_row['call_id']
            )
            await conn.execute(
                "UPDATE call_sessions SET status = 'pending' WHERE session_id = $1",
                session_id
            )

async def update_call_connection_type(room_id: str, connection_type: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        session_row = await conn.fetchrow("SELECT session_id FROM call_sessions WHERE room_id = $1", room_id)
        if not session_row:
            logger.error(f"Не удалось найти сессию для room_id {room_id} при обновлении типа соединения.")
            return
        session_id = session_row['session_id']

        call_row = await conn.fetchrow(
            """
            SELECT call_id FROM call_history
            WHERE session_id = $1 AND call_ended_at IS NULL
            ORDER BY call_started_at DESC LIMIT 1
            """,
            session_id
        )

        if call_row:
            await conn.execute(
                "UPDATE call_history SET connection_type = $1 WHERE call_id = $2",
                connection_type, call_row['call_id']
            )
            logger.info(f"Тип соединения для звонка в комнате {room_id} обновлен на '{connection_type}'.")

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

async def get_connections_info(date_obj: date) -> List[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        sessions = await conn.fetch(
            "SELECT session_id, room_id, generated_by_user_id, created_at, status, closed_at, close_reason FROM call_sessions WHERE date(created_at) = $1 ORDER BY created_at DESC",
            date_obj
        )
        results = []
        for session in sessions:
            session_dict = dict(session)
            
            calls = await conn.fetch(
                """
                SELECT call_type, call_started_at, duration_seconds, participant1_ip, participant2_ip, connection_type, initiator_ip
                FROM call_history WHERE session_id = $1 ORDER BY call_started_at ASC
                """,
                session_dict['session_id']
            )
            session_dict['calls'] = [dict(call) for call in calls]
            
            connections = await conn.fetch(
                """
                SELECT ip_address, device_type, os_info, browser_info, country, city
                FROM connections WHERE room_id = $1 ORDER BY connected_at ASC
                """,
                session_dict['room_id']
            )
            session_dict['connections'] = [dict(conn) for conn in connections]
            
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
        await conn.execute("TRUNCATE TABLE call_history, connections, bot_actions, call_sessions, users, admin_tokens, admin_settings RESTART IDENTITY CASCADE")
        logger.warning("Все таблицы базы данных были полностью очищены.")

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

async def get_admin_settings() -> Dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT key, value FROM admin_settings")
        settings = {}
        for row in rows:
            val = row['value']
            # Конвертируем строки 'true'/'false' в boolean для удобства
            if val.lower() == 'true':
                settings[row['key']] = True
            elif val.lower() == 'false':
                settings[row['key']] = False
            else:
                settings[row['key']] = val
        return settings

async def update_admin_settings(settings: Dict[str, Any]):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for key, value in settings.items():
                # Конвертируем boolean в строки перед сохранением
                val_str = str(value).lower() if isinstance(value, bool) else str(value)
                await conn.execute(
                    """
                    INSERT INTO admin_settings (key, value) VALUES ($1, $2)
                    ON CONFLICT (key) DO UPDATE SET value = $2
                    """,
                    key, val_str
                )
        logger.info("Настройки администратора обновлены.")

async def get_call_participants_details(room_id: str) -> Optional[Dict[str, Any]]:
    """
    Получает детали двух последних подключений в комнате и определяет, кто из них инициатор.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        initiator_ip = await conn.fetchval("""
            SELECT ch.initiator_ip
            FROM call_history ch
            JOIN call_sessions cs ON ch.session_id = cs.session_id
            WHERE cs.room_id = $1 AND ch.call_ended_at IS NULL
            ORDER BY ch.call_started_at DESC
            LIMIT 1
        """, room_id)

        if not initiator_ip:
            logger.warning(f"Не найден активный звонок или IP инициатора для комнаты {room_id}, чтобы получить детали участников.")
            return None

        connections = await conn.fetch("""
            SELECT ip_address, device_type, os_info, browser_info, country, city
            FROM connections
            WHERE room_id = $1
            ORDER BY connected_at DESC
            LIMIT 2
        """, room_id)

        if not connections:
            logger.error(f"Не найдены детали подключений для комнаты {room_id}.")
            return None

        initiator_details = None
        participant_details = None

        if len(connections) == 1:
            if connections[0]['ip_address'] == initiator_ip:
                initiator_details = dict(connections[0])
            else:
                participant_details = dict(connections[0])
        
        elif len(connections) == 2:
            conn1 = dict(connections[0])
            conn2 = dict(connections[1])
            if conn1['ip_address'] == initiator_ip:
                initiator_details = conn1
                participant_details = conn2
            elif conn2['ip_address'] == initiator_ip:
                initiator_details = conn2
                participant_details = conn1
            else:
                logger.warning(f"Не удалось сопоставить IP инициатора {initiator_ip} для комнаты {room_id}. Роли назначены по порядку подключения.")
                initiator_details = conn2
                participant_details = conn1

        return {
            "initiator": initiator_details,
            "participant": participant_details
        }