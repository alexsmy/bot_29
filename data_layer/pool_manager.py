
import os
import asyncpg
from typing import Optional

from configurable_logger import log

DATABASE_URL = os.environ.get("DATABASE_URL")
_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    """
    Создает или возвращает существующий пул соединений с базой данных.
    """
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL не установлена в переменных окружения")
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        log("DB_LIFECYCLE", "Пул соединений с базой данных успешно создан.")
    return _pool

async def close_pool():
    """
    Закрывает пул соединений с базой данных.
    """
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        log("DB_LIFECYCLE", "Пул соединений с базой данных закрыт.")

async def init_db():
    """
    Инициализирует структуру базы данных, создавая таблицы, если они не существуют.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                first_seen TIMESTAMPTZ NOT NULL,
                status TEXT NOT NULL DEFAULT 'active'
            )
        ''')
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'")
        except asyncpg.exceptions.DuplicateColumnError:
            pass
        
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
    log("DB_LIFECYCLE", "База данных PostgreSQL успешно инициализирована.")