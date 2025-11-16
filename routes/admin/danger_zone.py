import logging
from fastapi import APIRouter, HTTPException

import database
from core import CustomJSONResponse
from configurable_logger import log

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
        log("ERROR", f"Ошибка при очистке базы данных: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail=f"Database clearing failed: {e}")