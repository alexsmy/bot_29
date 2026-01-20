import os
import ssl
import asyncpg
import logging
from typing import Optional

from configurable_logger import log

DATABASE_URL = os.environ.get("DATABASE_URL")
_pool: Optional[asyncpg.Pool] = None

def create_ssl_context(url: str) -> Optional[ssl.SSLContext]:
    """
    Создает SSL контекст для подключения к удаленной базе данных
    (Supabase, Neon, Render Postgres и т.д.).
    """
    if not url:
        return None
        
    # Если мы работаем локально (на компьютере), SSL обычно не нужен
    if "localhost" in url or "127.0.0.1" in url:
        return None

    # Для облачных провайдеров создаем контекст, который требует шифрования,
    # но не проверяет строго сертификаты (чтобы избежать ошибок с самоподписанными сертификатами)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL не установлена в переменных окружения")
        
        try:
            # 1. Создаем настройки SSL
            ssl_ctx = create_ssl_context(DATABASE_URL)
            
            # 2. Создаем пул соединений, передавая SSL контекст
            _pool = await asyncpg.create_pool(
                dsn=DATABASE_URL, 
                min_size=2, 
                max_size=10,
                ssl=ssl_ctx
            )
            log("DB_LIFECYCLE", "Пул соединений с базой данных успешно создан.")
            
        except Exception as e:
            log("CRITICAL", f"Не удалось подключиться к базе данных: {e}", level=logging.CRITICAL)
            # Пробрасываем ошибку дальше, чтобы приложение не запустилось с нерабочей БД
            raise e
            
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        log("DB_LIFECYCLE", "Пул соединений с базой данных закрыт.")

async def init_db():
    """
    Создает таблицы, если их нет.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Таблица пользователей
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
        # Миграция для старых БД: добавляем колонку status, если её нет
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'")
        except asyncpg.exceptions.DuplicateColumnError:
            pass
        
        # Таблица действий (логов)
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS bot_actions (
                action_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                action TEXT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL
            )
        ''')
        
        # Таблица сессий звонков
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS call_sessions (
                session_id SERIAL PRIMARY KEY,
                room_id TEXT NOT NULL UNIQUE,
                generated_by_user_id BIGINT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                status TEXT DEFAULT 'pending',
                closed_at TIMESTAMPTZ,
                close_reason TEXT,
                room_type TEXT NOT NULL DEFAULT 'private'
            )
        ''')
        try:
            await conn.execute("ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS room_type TEXT NOT NULL DEFAULT 'private'")
        except asyncpg.exceptions.DuplicateColumnError:
            pass

        # Таблица истории звонков
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
                initiator_ip TEXT,
                initiator_user_id TEXT
            )
        ''')
        try:
            await conn.execute("ALTER TABLE call_history ADD COLUMN IF NOT EXISTS initiator_user_id TEXT")
        except asyncpg.exceptions.DuplicateColumnError:
            pass

        # Таблица технических подключений (IP, User-Agent)
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
                city TEXT,
                user_id TEXT
            )
        ''')
        try:
            await conn.execute("ALTER TABLE connections ADD COLUMN IF NOT EXISTS user_id TEXT")
        except asyncpg.exceptions.DuplicateColumnError:
            pass

        # Таблица токенов админа
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS admin_tokens (
                token TEXT PRIMARY KEY,
                expires_at TIMESTAMPTZ NOT NULL
            )
        ''')
        log("DB_LIFECYCLE", "База данных PostgreSQL успешно инициализирована.")