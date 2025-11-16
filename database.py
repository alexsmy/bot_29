
"""
Фасадный модуль для доступа к данным.

Этот модуль импортирует все функции запросов из пакета 'data_layer'
и предоставляет их остальной части приложения. Это позволяет проводить
рефакторинг слоя данных, не изменяя код в других частях проекта,
которые зависят от этого модуля.
"""

# Управление пулом соединений и инициализация БД
from data_layer.pool_manager import get_pool, close_pool, init_db

# Запросы, связанные с пользователями
from data_layer.user_queries import (
    log_user,
    get_users_info,
    get_user_status,
    update_user_status,
    delete_user
)

# Запросы, связанные с действиями пользователей и спамом
from data_layer.action_queries import (
    log_bot_action,
    get_user_actions,
    count_spam_strikes,
    forgive_spam_strikes
)

# Запросы, связанные с сессиями звонков и историей
from data_layer.call_queries import (
    log_call_session,
    log_call_start,
    log_call_end,
    update_call_connection_type,
    get_call_session_details,
    get_call_participants_details
)

# Запросы, связанные с логикой комнат
from data_layer.room_queries import (
    log_room_closure,
    get_room_lifetime_hours,
    get_all_active_sessions,
    count_active_rooms_by_user,
    count_recent_room_creations_by_user
)

# Запросы, связанные с информацией о подключениях
from data_layer.connection_queries import (
    log_connection,
    get_connections_info
)

# Запросы для получения статистики
from data_layer.stats_queries import get_stats

# Запросы для управления токенами администратора
from data_layer.token_queries import (
    add_admin_token,
    get_admin_token_expiry
)

# Запросы для опасных операций (очистка данных)
from data_layer.danger_zone_queries import clear_all_data

# Экспортируем все импортированные функции, чтобы они были доступны через `database.*`
__all__ = [
    'get_pool', 'close_pool', 'init_db',
    'log_user', 'get_users_info', 'get_user_status', 'update_user_status', 'delete_user',
    'log_bot_action', 'get_user_actions', 'count_spam_strikes', 'forgive_spam_strikes',
    'log_call_session', 'log_call_start', 'log_call_end', 'update_call_connection_type',
    'get_call_session_details', 'get_call_participants_details',
    'log_room_closure', 'get_room_lifetime_hours', 'get_all_active_sessions',
    'count_active_rooms_by_user', 'count_recent_room_creations_by_user',
    'log_connection', 'get_connections_info',
    'get_stats',
    'add_admin_token', 'get_admin_token_expiry',
    'clear_all_data'
]