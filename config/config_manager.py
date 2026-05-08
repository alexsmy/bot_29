from __future__ import annotations

import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, List

from utils.logger import log

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = PROJECT_ROOT / "config" / "keep_alive_settings.json"

DEFAULT_CONFIG: Dict[str, Any] = {
    "settings": {
        "min_wait_minutes": 13,
        "max_wait_minutes": 14,
        "error_wait_seconds": 60,
        "initial_delay_seconds": 10,
        "request_timeout_seconds": 30,
        "internet_check_timeout_seconds": 10,
    },
    "targets": [],
}


def _to_int(value: Any, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default

    if minimum is not None:
        result = max(result, minimum)
    if maximum is not None:
        result = min(result, maximum)
    return result


def _stable_target_id(target: Dict[str, Any], index: int) -> str:
    seed = "|".join(
        [
            str(target.get("name", "")),
            str(target.get("url", "")),
            str(target.get("env_override", "")),
            str(index),
        ]
    )
    return str(uuid.uuid5(uuid.NAMESPACE_URL, seed))


def _normalize_settings(raw_settings: Any) -> Dict[str, Any]:
    settings = dict(DEFAULT_CONFIG["settings"])
    if isinstance(raw_settings, dict):
        settings.update(raw_settings)

    min_wait = _to_int(settings.get("min_wait_minutes"), DEFAULT_CONFIG["settings"]["min_wait_minutes"], minimum=1)
    max_wait = _to_int(settings.get("max_wait_minutes"), DEFAULT_CONFIG["settings"]["max_wait_minutes"], minimum=1)
    if max_wait < min_wait:
        max_wait = min_wait

    normalized = {
        "min_wait_minutes": min_wait,
        "max_wait_minutes": max_wait,
        "error_wait_seconds": _to_int(settings.get("error_wait_seconds"), DEFAULT_CONFIG["settings"]["error_wait_seconds"], minimum=1),
        "initial_delay_seconds": _to_int(settings.get("initial_delay_seconds"), DEFAULT_CONFIG["settings"]["initial_delay_seconds"], minimum=0),
        "request_timeout_seconds": _to_int(settings.get("request_timeout_seconds"), DEFAULT_CONFIG["settings"]["request_timeout_seconds"], minimum=1),
        "internet_check_timeout_seconds": _to_int(
            settings.get("internet_check_timeout_seconds"),
            DEFAULT_CONFIG["settings"]["internet_check_timeout_seconds"],
            minimum=1,
        ),
    }
    return normalized


def _normalize_target(raw_target: Any, index: int) -> Dict[str, Any]:
    if not isinstance(raw_target, dict):
        raise ValueError(f"Target #{index + 1} должен быть объектом.")

    name = str(raw_target.get("name", "")).strip()
    url = str(raw_target.get("url", "")).strip()
    env_override = raw_target.get("env_override", None)
    target_id = str(raw_target.get("id", "")).strip() or _stable_target_id(raw_target, index)

    if not name:
        raise ValueError(f"Target #{index + 1}: имя сайта не заполнено.")
    if not url:
        raise ValueError(f"Target #{index + 1} ({name}): URL не заполнен.")

    enabled = raw_target.get("enabled", True)
    if isinstance(enabled, str):
        enabled = enabled.lower() not in {"false", "0", "off", "no"}
    else:
        enabled = bool(enabled)

    env_override = None if env_override in (None, "", "null") else str(env_override).strip()

    return {
        "id": target_id,
        "name": name,
        "url": url,
        "env_override": env_override,
        "enabled": enabled,
    }


def normalize_config(config: Any) -> Dict[str, Any]:
    if not isinstance(config, dict):
        raise ValueError("Конфигурация должна быть JSON-объектом.")

    normalized = {
        "settings": _normalize_settings(config.get("settings", {})),
        "targets": [],
    }

    raw_targets = config.get("targets", [])
    if raw_targets is None:
        raw_targets = []
    if not isinstance(raw_targets, list):
        raise ValueError("Поле targets должно быть массивом.")

    for index, target in enumerate(raw_targets):
        normalized["targets"].append(_normalize_target(target, index))

    return normalized


def load_advanced_config() -> Dict[str, Any]:
    """
    Загружает JSON-конфигурацию самоподдержки.
    Возвращает уже нормализованный объект, пригодный для UI и runtime.
    """
    if not CONFIG_FILE.exists():
        log("CONFIG", f"Файл {CONFIG_FILE} не найден. Используются настройки по умолчанию.")
        return json.loads(json.dumps(DEFAULT_CONFIG))

    try:
        with CONFIG_FILE.open("r", encoding="utf-8") as file:
            parsed_config = json.load(file)

        normalized = normalize_config(parsed_config)
        log("CONFIG", "Конфигурация успешно загружена.")
        return normalized
    except json.JSONDecodeError as error:
        log("ERROR", f"Ошибка парсинга {CONFIG_FILE}: {error}. Проверьте синтаксис JSON.")
        return json.loads(json.dumps(DEFAULT_CONFIG))
    except Exception as error:
        log("ERROR", f"Непредвиденная ошибка при чтении конфига: {error}")
        return json.loads(json.dumps(DEFAULT_CONFIG))


def save_advanced_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Сохраняет конфигурацию в JSON и возвращает нормализованную версию."""
    normalized = normalize_config(config)
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)

    fd, temp_path = tempfile.mkstemp(prefix="keep_alive_settings_", suffix=".json", dir=str(CONFIG_FILE.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as temp_file:
            json.dump(normalized, temp_file, ensure_ascii=False, indent=4)
            temp_file.write("\n")
        os.replace(temp_path, CONFIG_FILE)
        log("CONFIG", f"Конфигурация сохранена в {CONFIG_FILE}.")
        return normalized
    except Exception:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        raise