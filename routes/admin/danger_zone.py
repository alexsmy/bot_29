# routes/admin/danger_zone.py

from fastapi import APIRouter, HTTPException

import database
from core import CustomJSONResponse
from logger_config import logger

router = APIRouter()

@router.delete("/database", response_class=CustomJSONResponse)
async def clear_database():
    """
    Полностью очищает все таблицы в базе данных.
    """
    try:
        await database.clear_all_data()
        return {"status": "database cleared successfully"}
    except Exception as e:
        logger.error(f"Ошибка при очистке базы данных: {e}")
        raise HTTPException(status_code=500, detail=f"Database clearing failed: {e}")