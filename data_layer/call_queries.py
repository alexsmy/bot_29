import asyncpg
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from configurable_logger import log
from data_layer.pool_manager import get_pool

async def log_call_session(room_id: str, user_id: int, created_at: datetime, expires_at: datetime, room_type: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO call_sessions (room_id, generated_by_user_id, created_at, expires_at, room_type) VALUES ($1, $2, $3, $4, $5)",
            room_id, user_id, created_at, expires_at, room_type
        )

async def log_call_start(room_id: str, call_type: str, p1_ip: Optional[str], p2_ip: Optional[str], initiator_ip: Optional[str], initiator_user_id: Optional[str] = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        session_row = await conn.fetchrow("SELECT session_id FROM call_sessions WHERE room_id = $1", room_id)
        if not session_row:
            log("ERROR", f"Не удалось найти сессию для room_id {room_id} при старте звонка.", level=logging.ERROR)
            return
        session_id = session_row['session_id']

        await conn.execute(
            """
            INSERT INTO call_history (session_id, call_type, call_started_at, participant1_ip, participant2_ip, initiator_ip, initiator_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            session_id, call_type, datetime.now(timezone.utc), p1_ip, p2_ip, initiator_ip, initiator_user_id
        )
        await conn.execute("UPDATE call_sessions SET status = 'active' WHERE session_id = $1", session_id)

async def log_call_end(room_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        session_row = await conn.fetchrow("SELECT session_id FROM call_sessions WHERE room_id = $1", room_id)
        if not session_row:
            log("ERROR", f"Не удалось найти сессию для room_id {room_id} при завершении звонка.", level=logging.ERROR)
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
            log("ERROR", f"Не удалось найти сессию для room_id {room_id} при обновлении типа соединения.", level=logging.ERROR)
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
            log("DB_LIFECYCLE", f"Тип соединения для звонка в комнате {room_id} обновлен на '{connection_type}'.")

async def get_call_session_details(room_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT room_id, created_at, expires_at, room_type
            FROM call_sessions
            WHERE room_id = $1 AND expires_at > NOW() AND closed_at IS NULL
        """
        row = await conn.fetchrow(query, room_id)
        return dict(row) if row else None

async def get_call_participants_details(room_id: str) -> Optional[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Получаем initiator_user_id из активного звонка
        call_info = await conn.fetchrow("""
            SELECT ch.initiator_ip, ch.initiator_user_id
            FROM call_history ch
            JOIN call_sessions cs ON ch.session_id = cs.session_id
            WHERE cs.room_id = $1 AND ch.call_ended_at IS NULL
            ORDER BY ch.call_started_at DESC
            LIMIT 1
        """, room_id)

        if not call_info:
            log("DB_LIFECYCLE", f"Не найден активный звонок для комнаты {room_id}.", level=logging.WARNING)
            return None

        initiator_user_id = call_info.get('initiator_user_id')
        initiator_ip = call_info.get('initiator_ip')

        connections = await conn.fetch("""
            SELECT ip_address, device_type, os_info, browser_info, country, city, user_id
            FROM connections
            WHERE room_id = $1
            ORDER BY connected_at DESC
            LIMIT 2
        """, room_id)

        if not connections:
            log("ERROR", f"Не найдены детали подключений для комнаты {room_id}.", level=logging.ERROR)
            return None

        initiator_details = None
        participant_details = None

        # Логика сопоставления: Сначала пробуем по user_id, если нет - по IP (для старых записей)
        if len(connections) == 1:
            conn_dict = dict(connections[0])
            if initiator_user_id and conn_dict.get('user_id') == initiator_user_id:
                initiator_details = conn_dict
            elif not initiator_user_id and conn_dict['ip_address'] == initiator_ip:
                initiator_details = conn_dict
            else:
                participant_details = conn_dict
        
        elif len(connections) == 2:
            conn1 = dict(connections[0])
            conn2 = dict(connections[1])
            
            # Попытка 1: По user_id (надежно)
            if initiator_user_id:
                if conn1.get('user_id') == initiator_user_id:
                    initiator_details = conn1
                    participant_details = conn2
                elif conn2.get('user_id') == initiator_user_id:
                    initiator_details = conn2
                    participant_details = conn1
            
            # Попытка 2: По IP (ненадежно, но нужно для обратной совместимости)
            if not initiator_details:
                if conn1['ip_address'] == initiator_ip and conn2['ip_address'] != initiator_ip:
                    initiator_details = conn1
                    participant_details = conn2
                elif conn2['ip_address'] == initiator_ip and conn1['ip_address'] != initiator_ip:
                    initiator_details = conn2
                    participant_details = conn1
                else:
                    # Если IP одинаковые или не совпадают, просто назначаем по порядку
                    initiator_details = conn2
                    participant_details = conn1

        return {
            "initiator": initiator_details,
            "participant": participant_details
        }