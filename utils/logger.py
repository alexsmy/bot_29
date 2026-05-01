import logging
import sys

# Настраиваем базовый логгер для изолированного проекта
logger = logging.getLogger("keep_alive_logger")
logger.setLevel(logging.INFO)

if not logger.handlers:
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

    # Вывод в консоль (для логов Render)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Вывод в файл (для локального дебага)
    file_handler = logging.FileHandler("keep_alive.log", mode='a', encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

def log(category: str, message: str, level: int = logging.INFO, *args, **kwargs):
    """
    Упрощенная функция логирования, полностью совместимая с вызовами 
    из старого кода keep_alive.py.
    """
    formatted_message = f"[{category}] {message}"
    logger.log(level, formatted_message, *args, **kwargs)