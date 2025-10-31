# database.py

import os
import asyncpg
from datetime import datetime, date, timezone, timedelta
from typing import Dict
from logger_config import logger
from config import ADMIN_TOKEN_LIFETIME_MINUTES
DATABASE_URL = os.environ.get("DATABASE_URL")


async def get_conn():
    """Создает и возвращает соединение с базой данных PostgreSQL."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL не установлена в переменных окружения")
    return await asyncpg.connect(DATABASE_URL)

async def init_db():
    """Инициализирует базу данных, создает таблицы, если они не существуют."""
    conn = await get_conn()
    try:
        # --- Таблицы пользователей и действий ---
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
        # --- Таблицы звонков и соединений ---
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS call_sessions (
                session_id SERIAL PRIMARY KEY,
                room_id TEXT NOT NULL UNIQUE,
                generated_by_user_id BIGINT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                call_type TEXT,
                call_started_at TIMESTAMPTZ,
                call_ended_at TIMESTAMPTZ,
                duration_seconds INTEGER,
                status TEXT DEFAULT 'pending',
                closed_at TIMESTAMPTZ,
                close_reason TEXT
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS connections (
                connection_id SERIAL PRIMARY KEY,
                room_id TEXT NOT NULL REFERENCES call_sessions(room_id) ON DELETE CASCADE,
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
        # --- Таблица для токенов администратора ---
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS admin_tokens (
                token TEXT PRIMARY KEY,
                expires_at TIMESTAMPTZ NOT NULL
            )
        ''')
        
        # <<< НАЧАЛО ИЗМЕНЕНИЙ >>>
        # --- Таблица для настроек администратора ---
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS admin_settings (
                key TEXT PRIMARY KEY,
                value BOOLEAN NOT NULL
            )
        ''')
        # Заполняем значения по умолчанию, если они еще не существуют
        await conn.execute('''
            INSERT INTO admin_settings (key, value) VALUES
            ('notify_on_room_creation', TRUE),
            ('notify_on_call_start', TRUE),
            ('notify_on_call_end', TRUE),
            ('send_connection_report', TRUE)
            ON CONFLICT(key) DO NOTHING
        ''')
        # <<< КОНЕЦ ИЗМЕНЕНИЙ >>>

    finally:
        await conn.close()
    logger.info("База данных PostgreSQL успешно инициализирована.")

# ... (остальные функции log_user, log_bot_action и т.д. остаются без изменений) ...
async def log_user(user_id, first_name, last_name, username):
    conn = await get_conn()
    try:
        await conn.execute(
            """
            INSERT INTO users (user_id, first_name, last_name, username, first_seen)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO NOTHING
            """,
            user_id, first_name, last_name, username, datetime.now(timezone.utc)
        )
    finally:
        await conn.close()

async def log_bot_action(user_id, action):
    conn = await get_conn()
    try:
        await conn.execute(
            "INSERT INTO bot_actions (user_id, action, timestamp) VALUES ($1, $2, $3)",
            user_id, action, datetime.now(timezone.utc)
        )
    finally:
        await conn.close()

async def log_call_session(room_id, user_id, created_at, expires_at):
    conn = await get_conn()
    try:
        await conn.execute(
            "INSERT INTO call_sessions (room_id, generated_by_user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
            room_id, user_id, created_at, expires_at
        )
    finally:
        await conn.close()

async def log_connection(room_id, ip_address, user_agent, parsed_data):
    conn = await get_conn()
    try:
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
    finally:
        await conn.close()

async def log_call_start(room_id, call_type):
    conn = await get_conn()
    try:
        await conn.execute(
            "UPDATE call_sessions SET call_type = $1, call_started_at = $2, status = 'active' WHERE room_id = $3",
            call_type, datetime.now(timezone.utc), room_id
        )
    finally:
        await conn.close()

async def log_call_end(room_id):
    conn = await get_conn()
    try:
        row = await conn.fetchrow("SELECT call_started_at FROM call_sessions WHERE room_id = $1 AND status = 'active'", room_id)
        if row and row['call_started_at']:
            start_time = row['call_started_at']
            end_time = datetime.now(timezone.utc)
            duration = int((end_time - start_time).total_seconds())
            await conn.execute(
                "UPDATE call_sessions SET call_ended_at = $1, duration_seconds = $2, status = 'completed' WHERE room_id = $3",
                end_time, duration, room_id
            )
    finally:
        await conn.close()

async def log_room_closure(room_id, reason):
    conn = await get_conn()
    try:
        await conn.execute(
            "UPDATE call_sessions SET closed_at = $1, close_reason = $2, status = 'closed' WHERE room_id = $3 AND closed_at IS NULL",
            datetime.now(timezone.utc), reason, room_id
        )
    finally:
        await conn.close()

async def add_admin_token(token: str):
    """Сохраняет токен администратора в базу данных."""
    conn = await get_conn()
    try:
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=ADMIN_TOKEN_LIFETIME_MINUTES)
        await conn.execute(
            "INSERT INTO admin_tokens (token, expires_at) VALUES ($1, $2)",
            token, expiry_time
        )
    finally:
        await conn.close()

async def is_admin_token_valid(token: str) -> bool:
    """Проверяет валидность токена администратора в базе данных."""
    conn = await get_conn()
    try:
        await conn.execute("DELETE FROM admin_tokens WHERE expires_at < $1", datetime.now(timezone.utc))
        row = await conn.fetchrow("SELECT 1 FROM admin_tokens WHERE token = $1", token)
        return row is not None
    finally:
        await conn.close()

async def get_stats(period):
    query_parts = {
        "day": "WHERE first_seen >= NOW() - INTERVAL '1 day'",
        "week": "WHERE first_seen >= NOW() - INTERVAL '7 days'",
        "month": "WHERE first_seen >= NOW() - INTERVAL '30 days'",
        "all": ""
    }
    date_filter = query_parts.get(period, "")
    conn = await get_conn()
    try:
        total_users = await conn.fetchval(f"SELECT COUNT(*) FROM users {date_filter}")
        total_actions = await conn.fetchval("SELECT COUNT(*) FROM bot_actions")
        total_sessions = await conn.fetchval("SELECT COUNT(*) FROM call_sessions")
        completed_calls_data = await conn.fetchrow("SELECT COUNT(*) as count, AVG(duration_seconds) as avg_duration FROM call_sessions WHERE status = 'completed'")
        return {
            "total_users": total_users or 0,
            "total_actions": total_actions or 0,
            "total_sessions_created": total_sessions or 0,
            "completed_calls": completed_calls_data['count'] or 0,
            "avg_call_duration": round(completed_calls_data['avg_duration'] or 0)
        }
    finally:
        await conn.close()

async def get_users_info():
    conn = await get_conn()
    try:
        rows = await conn.fetch("SELECT user_id, first_name, last_name, username, first_seen FROM users ORDER BY first_seen DESC")
        return [dict(row) for row in rows]
    finally:
        await conn.close()

async def get_user_actions(user_id):
    conn = await get_conn()
    try:
        rows = await conn.fetch("SELECT action, timestamp FROM bot_actions WHERE user_id = $1 ORDER BY timestamp DESC", user_id)
        return [dict(row) for row in rows]
    finally:
        await conn.close()

async def get_connections_info(date_obj: date):
    conn = await get_conn()
    try:
        sessions = await conn.fetch(
            "SELECT room_id, created_at, status, call_type, duration_seconds, closed_at, close_reason FROM call_sessions WHERE date(created_at) = $1 ORDER BY created_at DESC",
            date_obj
        )
        results = []
        for session in sessions:
            session_dict = dict(session)
            connections = await conn.fetch(
                "SELECT ip_address, device_type, os_info, browser_info, country, city FROM connections WHERE room_id = $1",
                session_dict['room_id']
            )
            session_dict['participants'] = [dict(conn) for conn in connections]
            results.append(session_dict)
        return results
    finally:
        await conn.close()

async def get_call_session_details(room_id: str):
    """
    Получает детали сессии звонка из базы данных, если она существует и не истекла.
    """
    conn = await get_conn()
    try:
        query = """
            SELECT room_id, created_at, expires_at
            FROM call_sessions
            WHERE room_id = $1 AND expires_at > NOW() AND closed_at IS NULL
        """
        row = await conn.fetchrow(query, room_id)
        return dict(row) if row else None
    finally:
        await conn.close()

async def get_room_lifetime_hours(room_id: str) -> int:
    """
    Возвращает время жизни комнаты в часах, получая его из базы данных.
    """
    conn = await get_conn()
    try:
        query = "SELECT created_at, expires_at FROM call_sessions WHERE room_id = $1"
        row = await conn.fetchrow(query, room_id)
        if not row:
            from config import PRIVATE_ROOM_LIFETIME_HOURS
            return PRIVATE_ROOM_LIFETIME_HOURS
        
        created_at = row['created_at']
        expires_at = row['expires_at']
        
        lifetime_seconds = (expires_at - created_at).total_seconds()
        return round(lifetime_seconds / 3600)
    finally:
        await conn.close()

async def clear_all_data():
    """Очищает все данные из всех таблиц базы данных."""
    conn = await get_conn()
    try:
        await conn.execute("TRUNCATE TABLE admin_tokens, connections, bot_actions, call_sessions, users, admin_settings RESTART IDENTITY CASCADE")
        logger.warning("Все таблицы базы данных были полностью очищены.")
    finally:
        await conn.close()

async def get_all_active_sessions():
    """
    Получает все активные (не истекшие и не закрытые) сессии из базы данных.
    """
    conn = await get_conn()
    try:
        query = """
            SELECT room_id, created_at, expires_at
            FROM call_sessions
            WHERE expires_at > NOW() AND closed_at IS NULL
            ORDER BY created_at DESC
        """
        rows = await conn.fetch(query)
        return [dict(row) for row in rows]
    finally:
        await conn.close()

# <<< НАЧАЛО ИЗМЕНЕНИЙ >>>
async def get_notification_settings() -> Dict[str, bool]:
    """Получает все настройки уведомлений из базы данных."""
    conn = await get_conn()
    try:
        rows = await conn.fetch("SELECT key, value FROM admin_settings")
        return {row['key']: row['value'] for row in rows}
    finally:
        await conn.close()

async def update_notification_settings(settings: Dict[str, bool]):
    """Обновляет настройки уведомлений в базе данных."""
    conn = await get_conn()
    try:
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
    finally:
        await conn.close()
# <<< КОНЕЦ ИЗМЕНЕНИЙ >>>