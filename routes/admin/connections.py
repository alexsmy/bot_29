# routes/admin/connections.py

from datetime import datetime
from fastapi import APIRouter, HTTPException

import database
from core import CustomJSONResponse

router = APIRouter()

@router.get("/connections", response_class=CustomJSONResponse)
async def get_admin_connections(date: str):
    """
    Возвращает информацию о сессиях звонков за определенную дату.
    """
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    connections = await database.get_connections_info(date_obj)
    return connections