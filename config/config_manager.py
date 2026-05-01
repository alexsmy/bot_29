import os
import json
from utils.logger import log

# Обрати внимание: расширение изменено на .json
CONFIG_FILE = "config/keep_alive_settings.json"

def load_advanced_config() -> dict:
    """
    Загружает стандартный JSON файл конфигурации.
    Фильтрует отключенные таргеты, передавая в основной алгоритм только активные.
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
            # Используем стандартный безопасный парсер JSON
            parsed_config = json.load(f)

        # Фильтруем таргеты: оставляем только те, где "enabled": true
        if "targets" in parsed_config:
            active_targets = [
                t for t in parsed_config["targets"]
                if t.get("enabled", True)
            ]
            parsed_config["targets"] = active_targets

        log("CONFIG", "Конфигурация успешно загружена.")
        return parsed_config

    except json.JSONDecodeError as e:
        log("ERROR", f"Ошибка парсинга {CONFIG_FILE}: {e}. Проверьте синтаксис JSON.")
        return default_config
    except Exception as e:
        log("ERROR", f"Непредвиденная ошибка при чтении конфига: {e}")
        return default_config