from __future__ import annotations

import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict

from config.keepalive_security import (
    ConfigTamperError,
    attach_config_signature,
    assert_config_integrity,
    ensure_signed_config,
    get_initial_settings_pin,
    make_pin_record,
    public_security_config,
    save_integrity_signature,
    validate_pin_format,
)
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

SECURITY_PUBLIC_KEYS = {"pin_configured", "pin_min_length", "pin_max_length"}


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


def _security_from_existing(existing_security: Any) -> Dict[str, Any] | None:
    if not isinstance(existing_security, dict):
        return None

    pin_hash = str(existing_security.get("settings_pin_hash") or "")
    pin_salt = str(existing_security.get("settings_pin_salt") or "")
    if not pin_hash or not pin_salt:
        return None

    result = {
        "settings_pin_hash": pin_hash,
        "settings_pin_salt": pin_salt,
    }
    signature = existing_security.get("config_signature")
    if signature:
        result["config_signature"] = str(signature)
    return result


def _normalize_security(raw_security: Any, previous_security: Dict[str, Any] | None = None) -> Dict[str, Any]:
    security = _security_from_existing(previous_security) or _security_from_existing(raw_security)

    if isinstance(raw_security, dict):
        new_pin = str(raw_security.get("settings_pin") or "").strip()
        if new_pin:
            validate_pin_format(new_pin)
            security = make_pin_record(new_pin)

    if security is None:
        security = make_pin_record(get_initial_settings_pin())

    return security


def normalize_config(config: Any, previous_security: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if not isinstance(config, dict):
        raise ValueError("Конфигурация должна быть JSON-объектом.")

    normalized = {
        "settings": _normalize_settings(config.get("settings", {})),
        "targets": [],
        "security": _normalize_security(config.get("security", {}), previous_security),
    }

    raw_targets = config.get("targets", [])
    if raw_targets is None:
        raw_targets = []
    if not isinstance(raw_targets, list):
        raise ValueError("Поле targets должно быть массивом.")

    for index, target in enumerate(raw_targets):
        normalized["targets"].append(_normalize_target(target, index))

    return normalized


def public_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Возвращает конфигурацию без хэша/соли/подписи для браузера и скачивания."""
    return {
        "settings": config.get("settings") or {},
        "targets": config.get("targets") or [],
        "security": public_security_config(config.get("security") or {}),
    }


def load_advanced_config(*, public: bool = False, strict_integrity: bool = False) -> Dict[str, Any]:
    """
    Загружает JSON-конфигурацию самоподдержки.
    Возвращает нормализованный объект, пригодный для UI и runtime.
    """
    if not CONFIG_FILE.exists():
        log("CONFIG", f"Файл {CONFIG_FILE} не найден. Используются настройки по умолчанию.")
        normalized_default = normalize_config(json.loads(json.dumps(DEFAULT_CONFIG)))
        signed_default = ensure_signed_config(normalized_default)
        return public_config(signed_default) if public else signed_default

    try:
        with CONFIG_FILE.open("r", encoding="utf-8") as file:
            parsed_config = json.load(file)

        normalized = normalize_config(parsed_config)
        assert_config_integrity(normalized)

        if not (normalized.get("security") or {}).get("config_signature"):
            normalized = _write_signed_config(normalized)
            log("CONFIG", "Конфигурация переведена на формат с подписью целостности.")

        log("CONFIG", "Конфигурация успешно загружена.")
        return public_config(normalized) if public else normalized
    except ConfigTamperError:
        log("ERROR", "Проверка целостности keep-alive конфигурации не пройдена.")
        if strict_integrity:
            raise
        fallback = normalize_config(json.loads(json.dumps(DEFAULT_CONFIG)))
        return public_config(fallback) if public else fallback
    except json.JSONDecodeError as error:
        log("ERROR", f"Ошибка парсинга {CONFIG_FILE}: {error}. Проверьте синтаксис JSON.")
        if strict_integrity:
            raise ValueError(f"Ошибка парсинга JSON-конфигурации: {error}") from error
        fallback = normalize_config(json.loads(json.dumps(DEFAULT_CONFIG)))
        return public_config(fallback) if public else fallback
    except Exception as error:
        log("ERROR", f"Непредвиденная ошибка при чтении конфига: {error}")
        if strict_integrity:
            raise
        fallback = normalize_config(json.loads(json.dumps(DEFAULT_CONFIG)))
        return public_config(fallback) if public else fallback


def _write_signed_config(normalized_config: Dict[str, Any]) -> Dict[str, Any]:
    signed = attach_config_signature(normalized_config)
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)

    fd, temp_path = tempfile.mkstemp(prefix="keep_alive_settings_", suffix=".json", dir=str(CONFIG_FILE.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as temp_file:
            json.dump(signed, temp_file, ensure_ascii=False, indent=4)
            temp_file.write("\n")
        os.replace(temp_path, CONFIG_FILE)
        save_integrity_signature(signed["security"]["config_signature"])
        return signed
    except Exception:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        raise


def save_advanced_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Сохраняет конфигурацию в JSON и возвращает нормализованную публичную версию."""
    current_config = load_advanced_config(strict_integrity=True)
    normalized = normalize_config(config, previous_security=current_config.get("security"))
    signed = _write_signed_config(normalized)
    log("CONFIG", f"Конфигурация сохранена в {CONFIG_FILE}.")
    return public_config(signed)
