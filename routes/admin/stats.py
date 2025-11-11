# routes/admin/stats.py

from fastapi import APIRouter

import database
from core import CustomJSONResponse

router = APIRouter()

@router.get("/stats", response_class=CustomJSONResponse)
async def get_admin_stats(period: str = "all"):
    """
    Возвращает статистику по приложению за указанный период.
    """
    stats = await database.get_stats(period)
    return stats