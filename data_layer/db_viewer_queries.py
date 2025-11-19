import asyncpg
from typing import List, Dict, Any
from data_layer.pool_manager import get_pool

async def get_all_tables() -> List[str]:
    """
    Возвращает список всех пользовательских таблиц в базе данных.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        return [row['table_name'] for row in rows]

async def get_table_data(table_name: str) -> List[Dict[str, Any]]:
    """
    Возвращает последние 100 записей из указанной таблицы.
    Включает защиту от SQL-инъекций путем проверки существования таблицы.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # 1. Проверяем, существует ли такая таблица (защита от инъекций)
        exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            );
        """, table_name)

        if not exists:
            raise ValueError(f"Table '{table_name}' does not exist.")

        # 2. Получаем имя первичного ключа или первой колонки для сортировки
        pk_column = await conn.fetchval("""
            SELECT column_name
            FROM information_schema.key_column_usage
            WHERE table_name = $1
            AND constraint_name LIKE '%pkey'
            LIMIT 1;
        """, table_name)
        
        # Если PK нет, берем первую колонку, или created_at если есть
        if not pk_column:
            columns = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = $1", table_name)
            col_names = [c['column_name'] for c in columns]
            if 'created_at' in col_names:
                pk_column = 'created_at'
            elif 'timestamp' in col_names:
                pk_column = 'timestamp'
            elif col_names:
                pk_column = col_names[0]
            else:
                return [] # Таблица без колонок?

        # 3. Выполняем запрос данных (используем форматирование строки, т.к. имя таблицы проверено)
        # asyncpg не позволяет передавать имя таблицы как параметр $1
        query = f"SELECT * FROM \"{table_name}\" ORDER BY \"{pk_column}\" DESC LIMIT 100"
        
        rows = await conn.fetch(query)
        
        # Преобразуем Record объекты в словари, сериализуя сложные типы
        result = []
        for row in rows:
            row_dict = dict(row)
            result.append(row_dict)
            
        return result