# database.py

import asyncpg
import os
from datetime import datetime, timedelta, date, timezone
from logger_config import logger

pool = None

async def get_pool():
    global pool
    if pool is None:
        try:
            pool = await asyncpg.create_pool(
                user=os.environ.get('DB_USER'),
                password=os.environ.get('DB_PASSWORD'),
                database=os.environ.get('DB_NAME'),
                host=os.environ.get('DB_HOST', 'localhost'),
                port=os.environ.get('DB_PORT', 5432)
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
                creator_user_id BIGINT REFERENCES users(user_id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                status TEXT DEFAULT 'active', -- active, closed, completed
                closed_at TIMESTAMPTZ,
                close_reason TEXT
            );
            CREATE TABLE IF NOT EXISTS connections (
                id SERIAL PRIMARY KEY,
                session_id INT REFERENCES call_sessions(id),
                ip_address TEXT,
                user_agent TEXT,
                connection_time TIMESTAMPTZ DEFAULT NOW(),
                parsed_data JSONB
            );
            CREATE TABLE IF NOT EXISTS calls (
                id SERIAL PRIMARY KEY,
                session_id INT REFERENCES call_sessions(id),
                start_time TIMESTAMPTZ DEFAULT NOW(),
                end_time TIMESTAMPTZ,
                duration_seconds INT,
                call_type TEXT, -- audio, video
                connection_type TEXT -- p2p, relay
            );
            -- НОВАЯ ТАБЛИЦА ДЛЯ СВЯЗИ ЗВОНКОВ И УЧАСТНИКОВ
            CREATE TABLE IF NOT EXISTS call_participants (
                id SERIAL PRIMARY KEY,
                call_id INT REFERENCES calls(id) ON DELETE CASCADE,
                connection_id INT REFERENCES connections(id) ON DELETE CASCADE,
                UNIQUE(call_id, connection_id)
            );
            CREATE TABLE IF NOT EXISTS admin_tokens (
                id SERIAL PRIMARY KEY,
                token UUID UNIQUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE IF NOT EXISTS admin_settings (
                key TEXT PRIMARY KEY,
                value JSONB
            );
        ''')
        logger.info("Проверка и инициализация таблиц в БД завершена.")
    finally:
        await (await get_pool()).release(conn)

async def log_user(user_id, first_name, last_name, username):
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

async def log_bot_action(user_id, action):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('INSERT INTO bot_actions (user_id, action) VALUES ($1, $2)', user_id, action)
    finally:
        await (await get_pool()).release(conn)

async def log_call_session(room_id, user_id, created_at, expires_at):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('''
            INSERT INTO call_sessions (room_id, creator_user_id, created_at, expires_at)
            VALUES ($1, $2, $3, $4)
        ''', room_id, user_id, created_at, expires_at)
    finally:
        await (await get_pool()).release(conn)

async def log_connection(room_id, ip_address, user_agent, parsed_data):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('''
            INSERT INTO connections (session_id, ip_address, user_agent, parsed_data)
            SELECT id, $2, $3, $4 FROM call_sessions WHERE room_id = $1
        ''', room_id, ip_address, user_agent, parsed_data)
    finally:
        await (await get_pool()).release(conn)

async def log_call_start(room_id: str, call_type: str, connection_type: str):
    """
    Ключевая новая функция. Создает запись о новом звонке и связывает
    двух последних подключившихся участников с этим звонком.
    """
    conn = await (await get_pool()).acquire()
    try:
        async with conn.transaction():
            # 1. Находим ID сессии по UUID комнаты
            session_id = await conn.fetchval('SELECT id FROM call_sessions WHERE room_id = $1', room_id)
            if not session_id:
                logger.warning(f"Попытка начать звонок в несуществующей сессии: {room_id}")
                return

            # 2. Создаем новую запись о звонке и получаем ее ID
            call_id = await conn.fetchval('''
                INSERT INTO calls (session_id, call_type, connection_type, start_time)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            ''', session_id, call_type, connection_type, datetime.now(timezone.utc))

            # 3. Находим ID двух последних уникальных подключений для этой сессии
            # Это гарантирует, что мы свяжем именно текущих двух участников
            last_two_connections = await conn.fetch('''
                SELECT id FROM connections
                WHERE session_id = $1
                ORDER BY connection_time DESC
                LIMIT 2
            ''', session_id)

            if len(last_two_connections) < 2:
                 logger.warning(f"Не удалось найти двух участников для звонка в сессии {room_id}. Найдено: {len(last_two_connections)}")

            # 4. Создаем записи в call_participants для связи звонка и участников
            for record in last_two_connections:
                await conn.execute('''
                    INSERT INTO call_participants (call_id, connection_id)
                    VALUES ($1, $2)
                ''', call_id, record['id'])
            
            logger.info(f"Успешно залогирован старт звонка (ID: {call_id}) в комнате {room_id}")

    except Exception as e:
        logger.error(f"Ошибка при логировании старта звонка для комнаты {room_id}: {e}")
    finally:
        await (await get_pool()).release(conn)

async def log_call_end(room_id: str):
    conn = await (await get_pool()).acquire()
    try:
        # Находим последний активный звонок в сессии и обновляем его
        await conn.execute('''
            WITH last_call AS (
                SELECT c.id
                FROM calls c
                JOIN call_sessions cs ON c.session_id = cs.id
                WHERE cs.room_id = $1 AND c.end_time IS NULL
                ORDER BY c.start_time DESC
                LIMIT 1
            )
            UPDATE calls
            SET
                end_time = NOW(),
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INT
            WHERE id = (SELECT id FROM last_call)
        ''', room_id)
        # Обновляем статус сессии на "completed"
        await conn.execute('''
            UPDATE call_sessions SET status = 'completed' WHERE room_id = $1
        ''', room_id)
    finally:
        await (await get_pool()).release(conn)

async def log_room_closure(room_id: str, reason: str):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('''
            UPDATE call_sessions
            SET status = 'closed', closed_at = NOW(), close_reason = $2
            WHERE room_id = $1 AND status = 'active'
        ''', room_id, reason)
    finally:
        await (await get_pool()).release(conn)

async def get_call_session_details(room_id: str):
    conn = await (await get_pool()).acquire()
    try:
        return await conn.fetchrow('''
            SELECT created_at, expires_at FROM call_sessions
            WHERE room_id = $1 AND expires_at > NOW()
        ''', room_id)
    finally:
        await (await get_pool()).release(conn)

async def get_room_lifetime_hours(room_id: str) -> int:
    conn = await (await get_pool()).acquire()
    try:
        record = await conn.fetchrow('''
            SELECT EXTRACT(EPOCH FROM (expires_at - created_at)) / 3600 as lifetime
            FROM call_sessions WHERE room_id = $1
        ''', room_id)
        return int(record['lifetime']) if record else 3
    finally:
        await (await get_pool()).release(conn)

async def get_connections_info(query_date: date):
    """
    Полностью переписанная функция для корректного получения данных.
    Теперь она правильно группирует звонки и их участников.
    """
    conn = await (await get_pool()).acquire()
    try:
        sessions = await conn.fetch('''
            SELECT id, room_id, status, created_at, closed_at, close_reason
            FROM call_sessions
            WHERE DATE(created_at AT TIME ZONE 'UTC') = $1
            ORDER BY created_at DESC
        ''', query_date)

        result = []
        for session in sessions:
            calls = await conn.fetch('''
                SELECT id, start_time, duration_seconds, call_type, connection_type
                FROM calls
                WHERE session_id = $1
                ORDER BY start_time ASC
            ''', session['id'])

            call_groups = []
            for call in calls:
                participants = await conn.fetch('''
                    SELECT
                        c.ip_address,
                        c.parsed_data->>'country' as country,
                        c.parsed_data->>'city' as city,
                        c.parsed_data->>'device' as device_type,
                        c.parsed_data->>'os' as os_info,
                        c.parsed_data->>'browser' as browser_info
                    FROM connections c
                    JOIN call_participants cp ON c.id = cp.connection_id
                    WHERE cp.call_id = $1
                ''', call['id'])
                
                call_groups.append({
                    "start_time": call['start_time'],
                    "duration_seconds": call['duration_seconds'],
                    "call_type": call['call_type'],
                    "connection_type": call['connection_type'],
                    "participants": [dict(p) for p in participants]
                })

            result.append({
                "room_id": str(session['room_id']),
                "status": session['status'],
                "created_at": session['created_at'],
                "closed_at": session['closed_at'],
                "close_reason": session['close_reason'],
                "call_groups": call_groups
            })
        return result
    finally:
        await (await get_pool()).release(conn)

# --- Остальные функции (get_stats, get_users_info и т.д.) остаются без изменений ---
# ... (здесь должен быть остальной код файла, который не менялся)
async def get_stats(period: str = "all"):
    conn = await (await get_pool()).acquire()
    try:
        interval_map = {
            "day": "1 day",
            "week": "7 days",
            "month": "1 month"
        }
        interval = interval_map.get(period)
        
        where_clause = f"WHERE timestamp >= NOW() - INTERVAL '{interval}'" if interval else ""

        total_users = await conn.fetchval('SELECT COUNT(*) FROM users')
        total_actions = await conn.fetchval(f'SELECT COUNT(*) FROM bot_actions {where_clause.replace("timestamp", "bot_actions.timestamp")}')
        total_sessions_created = await conn.fetchval(f'SELECT COUNT(*) FROM call_sessions {where_clause.replace("timestamp", "call_sessions.created_at")}')
        
        completed_calls_query = f'''
            SELECT COUNT(*), COALESCE(AVG(duration_seconds), 0) as avg_duration
            FROM calls
            {where_clause.replace("timestamp", "calls.start_time")} AND duration_seconds IS NOT NULL
        '''
        call_stats = await conn.fetchrow(completed_calls_query)
        completed_calls = call_stats['count']
        avg_call_duration = round(call_stats['avg_duration'])

        active_rooms_count = await conn.fetchval("SELECT COUNT(*) FROM call_sessions WHERE status = 'active' AND expires_at > NOW()")

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
        return await conn.fetch('SELECT action, timestamp FROM bot_actions WHERE user_id = $1 ORDER BY timestamp DESC', user_id)
    finally:
        await (await get_pool()).release(conn)

async def get_all_active_sessions():
    conn = await (await get_pool()).acquire()
    try:
        # Получаем последнюю информацию о звонке для каждой активной сессии
        query = '''
            WITH latest_call AS (
                SELECT
                    session_id,
                    call_type,
                    ROW_NUMBER() OVER(PARTITION BY session_id ORDER BY start_time DESC) as rn
                FROM calls
            )
            SELECT
                cs.room_id,
                cs.created_at,
                cs.expires_at,
                cs.status,
                lc.call_type
            FROM call_sessions cs
            LEFT JOIN latest_call lc ON cs.id = lc.session_id AND lc.rn = 1
            WHERE cs.status = 'active' AND cs.expires_at > NOW()
            ORDER BY cs.created_at DESC
        '''
        return await conn.fetch(query)
    finally:
        await (await get_pool()).release(conn)

async def add_admin_token(token: str):
    conn = await (await get_pool()).acquire()
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await conn.execute('INSERT INTO admin_tokens (token, expires_at) VALUES ($1, $2)', uuid.UUID(token), expires_at)
    finally:
        await (await get_pool()).release(conn)

async def get_admin_token_expiry(token: str) -> datetime | None:
    conn = await (await get_pool()).acquire()
    try:
        record = await conn.fetchrow('SELECT expires_at FROM admin_tokens WHERE token = $1 AND expires_at > NOW()', uuid.UUID(token))
        return record['expires_at'] if record else None
    finally:
        await (await get_pool()).release(conn)

async def get_notification_settings():
    conn = await (await get_pool()).acquire()
    try:
        defaults = {
            "notify_on_room_creation": True,
            "notify_on_call_start": True,
            "notify_on_call_end": True,
            "send_connection_report": True
        }
        record = await conn.fetchrow("SELECT value FROM admin_settings WHERE key = 'notifications'")
        if record:
            # Объединяем сохраненные настройки с дефолтными, чтобы новые ключи подхватывались
            settings = defaults.copy()
            settings.update(record['value'])
            return settings
        return defaults
    finally:
        await (await get_pool()).release(conn)

async def update_notification_settings(settings: dict):
    conn = await (await get_pool()).acquire()
    try:
        await conn.execute('''
            INSERT INTO admin_settings (key, value) VALUES ('notifications', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1
        ''', settings)
    finally:
        await (await get_pool()).release(conn)

async def clear_all_data():
    conn = await (await get_pool()).acquire()
    try:
        async with conn.transaction():
            await conn.execute('TRUNCATE TABLE bot_actions, call_sessions, connections, calls, call_participants, admin_tokens, admin_settings, users RESTART IDENTITY')
        logger.warning("Все данные в базе данных были очищены администратором.")
    finally:
        await (await get_pool()).release(conn)