import logging
import sys

# --- Константы ---
LOG_FILE_PATH = "app.log"
LOG_FORMAT = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

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

    # --- НОВАЯ СТРОКА ---
    # Понижаем уровень логирования для "шумных" библиотек
    logging.getLogger("httpx").setLevel(logging.WARNING)

    return logger

# Создаем и настраиваем логгер при импорте модуля
logger = setup_logger()
