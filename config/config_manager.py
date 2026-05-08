
import json
import os

from utils.logger import log

CONFIG_FILE = "config/keep_alive_settings.json"

DEFAULT_CONFIG = {
    "settings": {
        "min_wait_minutes": 13,
        "max_wait_minutes": 14,
        "error_wait_seconds": 60,
        "initial_delay_seconds": 10
    },
    "targets": []
}

def ensure_config_exists():
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)

    if not os.path.exists(CONFIG_FILE):
        save_advanced_config(DEFAULT_CONFIG)

def load_raw_config() -> dict:
    ensure_config_exists()

    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as error:
        log("ERROR", f"Ошибка чтения конфигурации: {error}")
        return DEFAULT_CONFIG

def load_advanced_config() -> dict:
    parsed_config = load_raw_config()

    if "targets" in parsed_config:
        parsed_config["targets"] = [
            target for target in parsed_config["targets"]
            if target.get("enabled", True)
        ]

    return parsed_config

def save_advanced_config(config: dict) -> dict:
    ensure_config_exists()

    with open(CONFIG_FILE, "w", encoding="utf-8") as file:
        json.dump(config, file, ensure_ascii=False, indent=4)

    log("CONFIG", "Конфигурация keep-alive обновлена через веб-интерфейс.")

    return config
