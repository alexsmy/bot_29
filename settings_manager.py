import json
import re
from logger_config import logger

# ИЗМЕНЕНИЕ: Указываем новое имя файла с расширением .jsonc
SETTINGS_FILE = "admin_settings.jsonc"
_settings = {}

def load_settings():
    """
    Загружает настройки из JSON-файла в память.
    Умеет обрабатывать файлы с однострочными (//) и многострочными (/* */) комментариями.
    Вызывается один раз при старте приложения.
    """
    global _settings
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Удаляем однострочные комментарии (// ...)
            content = re.sub(r"//.*", "", content)
            # Удаляем многострочные комментарии (/* ... */)
            content = re.sub(r"/\*[\s\S]*?\*/", "", content)
            
            _settings = json.loads(content)
            
        logger.info(f"Конфигурация администратора успешно загружена из {SETTINGS_FILE}.")
    except FileNotFoundError:
        logger.critical(f"Файл настроек {SETTINGS_FILE} не найден! Уведомления могут работать некорректно.")
    except json.JSONDecodeError as e:
        logger.critical(f"Ошибка парсинга файла настроек {SETTINGS_FILE}. Проверьте синтаксис JSON. Ошибка: {e}")

def get_setting(key: str, default: bool = False) -> bool:
    """
    Возвращает значение настройки по ключу.
    """
    return _settings.get(key, default)

# Загружаем настройки при импорте модуля
load_settings()