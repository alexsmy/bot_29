import logging
import sys

# --- Константы ---
LOG_FILE_PATH = "app.log"
LOG_FORMAT = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

def setup_loggers():
    """
    Настраивает и возвращает два независимых логгера: для файла и для консоли.
    """
    # --- Файловый логгер ---
    file_logger = logging.getLogger('file_logger')
    file_logger.setLevel(logging.INFO)
    file_logger.propagate = False # Предотвращаем дублирование в корневой логгер

    # Очищаем существующие обработчики, чтобы избежать дублирования при перезагрузке
    if file_logger.hasHandlers():
        file_logger.handlers.clear()
        
    try:
        file_handler = logging.FileHandler(LOG_FILE_PATH, mode='a', encoding='utf-8')
        file_handler.setFormatter(LOG_FORMAT)
        file_logger.addHandler(file_handler)
    except Exception as e:
        # Если не удалось, выводим ошибку в stderr
        print(f"CRITICAL: Не удалось настроить файловый логгер: {e}", file=sys.stderr)

    # --- Консольный логгер ---
    console_logger = logging.getLogger('console_logger')
    console_logger.setLevel(logging.INFO)
    console_logger.propagate = False

    if console_logger.hasHandlers():
        console_logger.handlers.clear()

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(LOG_FORMAT)
    console_logger.addHandler(stream_handler)

    # --- Настройка уровня для сторонних библиотек ---
    # Устанавливаем уровень для корневого логгера, чтобы повлиять на библиотеки
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("twilio").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    return file_logger, console_logger