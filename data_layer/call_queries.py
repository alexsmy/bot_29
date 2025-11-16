
import asyncpg
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from configurable_logger import log
from data_layer.pool_manager import get_pool

async def log_call_session(room_id: str, user_id: int, created_at: datetime, expires_at: datetime):
    """
    Записывает информацию о новой сессии звонка.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO call_sessions (room_id, generated_by_user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
            room_id, user_id, created_at, expires_at
        )

async def log_call_start(room_id: str, call_type: str, p1_ip: Optional[str], p2_ip: Optional[str], initiator_ip: Optional[str]):
    """
    Логирует начало звонка в истории и обновляет статус сессии.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        session_row = await conn.fetchrow("SELECT session_id FROM call_sessions WHERE room_id = $1", room_id)
        if not session_row:
            log("ERROR", f"Не удалось найти сессию для room_id {room_id} при старте звонка.", level=logging.ERROR)
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

async def log_call_end(room_id: str):
    """
    Логирует завершение звонка, рассчитывает длительность и обновляет статус сессии.
    """
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
    """
    Обновляет тип WebRTC соединения (P2P/Relay) для текущего активного звонка.
    """
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
    """
    Получает детали активной сессии звонка по ID комнаты.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT room_id, created_at, expires_at
            FROM call_sessions
            WHERE room_id = $1 AND expires_at > NOW() AND closed_at IS NULL
        """
        row = await conn.fetchrow(query, room_id)
        return dict(row) if row else None

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
            log("DB_LIFECYCLE", f"Не найден активный звонок или IP инициатора для комнаты {room_id}, чтобы получить детали участников.", level=logging.WARNING)
            return None

        connections = await conn.fetch("""
            SELECT ip_address, device_type, os_info, browser_info, country, city
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

        if len(connections) == 1:
            conn_dict = dict(connections[0])
            if conn_dict['ip_address'] == initiator_ip:
                initiator_details = conn_dict
            else:
                participant_details = conn_dict
        
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
                log("DB_LIFECYCLE", f"Не удалось сопоставить IP инициатора {initiator_ip} для комнаты {room_id}. Роли назначены по порядку подключения.", level=logging.WARNING)
                initiator_details = conn2
                participant_details = conn1

        return {
            "initiator": initiator_details,
            "participant": participant_details
        }