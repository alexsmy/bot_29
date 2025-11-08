# logger_config.py

import logging
import sys

LOG_FILE_PATH = "app.log"
LOG_FORMAT = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

def setup_logger():

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    if logger.hasHandlers():
        logger.handlers.clear()

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(LOG_FORMAT)
    logger.addHandler(stream_handler)

    try:
        file_handler = logging.FileHandler(LOG_FILE_PATH, mode='a', encoding='utf-8')
        file_handler.setFormatter(LOG_FORMAT)
        logger.addHandler(file_handler)
    except Exception as e:

        logging.basicConfig()
        logging.error(f"Не удалось настроить файловый логгер: {e}")

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("twilio").setLevel(logging.WARNING)

    return logger

logger = setup_logger()