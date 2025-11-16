import logging
from server_logger_config import LOG_CONFIG
from logger_config import setup_loggers

# Получаем настроенные логгеры при импорте модуля
file_logger, console_logger = setup_loggers()

# Создаем плоский словарь для быстрого доступа к конфигурации
_flat_config = {}
for group in LOG_CONFIG.values():
    _flat_config.update(group)

def log(category: str, message: str, level: int = logging.INFO, *args, **kwargs):
    """
    Централизованная функция логирования, управляемая через server_logger_config.py.

    :param category: Категория лога (ключ из LOG_CONFIG).
    :param message: Сообщение для лога.
    :param level: Уровень логирования (logging.INFO, logging.WARNING и т.д.).
    :param args: Дополнительные аргументы для форматирования сообщения.
    :param kwargs: Дополнительные именованные аргументы для форматирования.
    """
    config = _flat_config.get(category)

    if config is None:
        # Если категория не найдена, логируем это как ошибку конфигурации
        # и выводим сообщение по умолчанию, чтобы не потерять его.
        console_logger.warning(f"[CONFIG_ERROR] Лог с неизвестной категорией: '{category}'. Сообщение: {message}")
        file_logger.warning(f"[CONFIG_ERROR] Лог с неизвестной категорией: '{category}'. Сообщение: {message}")
        return

    # Форматируем сообщение с категорией для наглядности
    formatted_message = f"[{category}] {message}"

    # Запись в файл
    if config.get("file", False):
        file_logger.log(level, formatted_message, *args, **kwargs)

    # Вывод в консоль
    if config.get("console", False):
        console_logger.log(level, formatted_message, *args, **kwargs)