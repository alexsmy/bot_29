import asyncpg
from typing import List, Dict, Any, Tuple
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

async def get_table_data(table_name: str, limit: int = 100, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    """
    Возвращает записи из таблицы с пагинацией и общее количество строк.
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
                return [], 0 # Таблица без колонок

        # 3. Получаем общее количество строк (для пагинации)
        # Используем форматирование, так как имя таблицы проверено выше
        count_query = f"SELECT COUNT(*) FROM \"{table_name}\""
        total_count = await conn.fetchval(count_query)

        # 4. Выполняем запрос данных с LIMIT и OFFSET
        query = f"SELECT * FROM \"{table_name}\" ORDER BY \"{pk_column}\" DESC LIMIT {limit} OFFSET {offset}"
        
        rows = await conn.fetch(query)
        
        # Преобразуем Record объекты в словари
        result = []
        for row in rows:
            row_dict = dict(row)
            result.append(row_dict)
            
        return result, total_count