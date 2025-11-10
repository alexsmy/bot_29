# logger_config.py 56_2 понижаем шум логов

import logging
import sys

# --- Константы ---
LOG_FILE_PATH = "app.log"
LOG_FORMAT = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

# ИЗМЕНЕНИЕ: Добавляем класс для фильтрации логов доступа
class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Исключаем из логов все запросы к эндпоинту /log
        return record.getMessage().find("POST /log HTTP/1.1") == -1

def setup_logger():
    """Настраивает и возвращает корневой логгер."""
    # Получаем корневой логгер
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # Предотвращаем дублирование обработчиков, если функция вызывается повторно
    if logger.hasHandlers():
        logger.handlers.clear()

    # Обработчик для вывода в консоль (stdout)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(LOG_FORMAT)
    logger.addHandler(stream_handler)

    # Обработчик для записи в файл
    try:
        file_handler = logging.FileHandler(LOG_FILE_PATH, mode='a', encoding='utf-8')
        file_handler.setFormatter(LOG_FORMAT)
        logger.addHandler(file_handler)
    except Exception as e:
        # Если не удалось создать файловый обработчик, выводим ошибку в консоль
        logging.basicConfig()
        logging.error(f"Не удалось настроить файловый логгер: {e}")

    # ИЗМЕНЕНИЕ: Применяем фильтр к логгеру uvicorn.access
    logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

    # Понижаем уровень логирования для "шумных" библиотек
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("twilio").setLevel(logging.WARNING)

    return logger

# Создаем и настраиваем логгер при импорте модуля
logger = setup_logger()