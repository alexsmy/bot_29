from fastapi import APIRouter, HTTPException

import database
from core import CustomJSONResponse

router = APIRouter()

@router.get("/database/tables", response_class=CustomJSONResponse)
async def get_tables_list():
    """
    Возвращает список всех таблиц в базе данных.
    """
    try:
        tables = await database.get_all_tables()
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tables: {e}")

@router.get("/database/table/{table_name}", response_class=CustomJSONResponse)
async def get_table_content(table_name: str):
    """
    Возвращает содержимое (последние 100 строк) указанной таблицы.
    """
    try:
        data = await database.get_table_data(table_name)
        return data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch table data: {e}")