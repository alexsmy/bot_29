import asyncpg
from datetime import datetime, date, timezone
from typing import List, Dict, Any

from data_layer.pool_manager import get_pool

async def log_connection(room_id: str, ip_address: str, user_agent: str, parsed_data: dict, user_id: str = None):
    """
    Записывает информацию о новом подключении к комнате.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO connections (
                room_id, connected_at, ip_address, user_agent,
                device_type, os_info, browser_info, country, city, user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            room_id, datetime.now(timezone.utc), ip_address, user_agent,
            parsed_data['device'], parsed_data['os'], parsed_data['browser'],
            parsed_data['country'], parsed_data['city'], user_id
        )

async def get_connections_info(date_obj: date) -> List[Dict[str, Any]]:
    """
    Возвращает подробную информацию о сессиях, звонках и подключениях за указанную дату.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        sessions = await conn.fetch(
            "SELECT session_id, room_id, generated_by_user_id, created_at, status, closed_at, close_reason FROM call_sessions WHERE date(created_at) = $1 ORDER BY created_at DESC",
            date_obj
        )
        results = []
        for session in sessions:
            session_dict = dict(session)
            
            # Добавляем initiator_user_id в выборку
            calls = await conn.fetch(
                """
                SELECT call_type, call_started_at, duration_seconds, participant1_ip, participant2_ip, connection_type, initiator_ip, initiator_user_id
                FROM call_history WHERE session_id = $1 ORDER BY call_started_at ASC
                """,
                session_dict['session_id']
            )
            session_dict['calls'] = [dict(call) for call in calls]
            
            # Добавляем user_id в выборку
            connections = await conn.fetch(
                """
                SELECT ip_address, device_type, os_info, browser_info, country, city, user_id
                FROM connections WHERE room_id = $1 ORDER BY connected_at ASC
                """,
                session_dict['room_id']
            )
            session_dict['connections'] = [dict(conn) for conn in connections]
            
            results.append(session_dict)
        return results