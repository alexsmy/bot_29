import os
import json
import re
from utils.logger import log

CONFIG_FILE = "config/keep_alive_settings.jsonc"

def load_advanced_config() -> dict:
    """
    Загружает и парсит улучшенный конфигурационный файл JSONC.
    Удаляет комментарии и фильтрует отключенные таргеты, передавая 
    в основной алгоритм только чистые данные.
    """
    default_config = {
        "settings": {
            "min_wait_minutes": 13,
            "max_wait_minutes": 14,
            "error_wait_seconds": 60,
            "initial_delay_seconds": 10
        },
        "targets":[]
    }

    if not os.path.exists(CONFIG_FILE):
        log("CONFIG", f"Файл {CONFIG_FILE} не найден. Используются настройки по умолчанию.")
        return default_config

    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            content = f.read()

        # Удаляем однострочные (//) и многострочные (/* */) комментарии
        content = re.sub(r"//.*", "", content)
        content = re.sub(r"/\*[\s\S]*?\*/", "", content)

        parsed_config = json.loads(content)

        # Фильтруем таргеты: оставляем только те, где "enabled": true
        if "targets" in parsed_config:
            active_targets = [
                t for t in parsed_config["targets"]
                if t.get("enabled", True)
            ]
            parsed_config["targets"] = active_targets

        log("CONFIG", "Улучшенная конфигурация успешно загружена.")
        return parsed_config

    except json.JSONDecodeError as e:
        log("ERROR", f"Ошибка парсинга {CONFIG_FILE}: {e}. Проверьте синтаксис JSON.")
        return default_config
    except Exception as e:
        log("ERROR", f"Непредвиденная ошибка при чтении конфига: {e}")
        return default_config