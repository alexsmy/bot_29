from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import stat
import time
from pathlib import Path
from typing import Any, Dict

from utils.logger import log

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = PROJECT_ROOT / "config"
SECRET_FILE = CONFIG_DIR / ".keep_alive_secret"
INTEGRITY_FILE = CONFIG_DIR / ".keep_alive_integrity.json"
PIN_ITERATIONS = 200_000
PIN_MIN_LENGTH = 4
PIN_MAX_LENGTH = 6
DEFAULT_SETTINGS_PIN = "1234"
TOKEN_TTL_SECONDS = 30 * 60
AUTH_COOKIE_NAME = "keepalive_settings_token"


class ConfigTamperError(ValueError):
    """Raised when keep-alive JSON configuration integrity validation fails."""


class PinValidationError(ValueError):
    """Raised when a settings PIN does not match the required format."""


def validate_pin_format(pin: str) -> str:
    normalized = str(pin or "").strip()
    if not normalized.isdigit() or not PIN_MIN_LENGTH <= len(normalized) <= PIN_MAX_LENGTH:
        raise PinValidationError("Пин-код должен состоять только из 4–6 цифр.")
    return normalized


def get_initial_settings_pin() -> str:
    candidate = os.environ.get("KEEPALIVE_SETTINGS_PIN", DEFAULT_SETTINGS_PIN)
    try:
        return validate_pin_format(candidate)
    except PinValidationError:
        log(
            "SECURITY",
            "Переменная KEEPALIVE_SETTINGS_PIN задана неверно. Используется безопасное значение по умолчанию 1234.",
        )
        return DEFAULT_SETTINGS_PIN


def _set_private_permissions(path: Path) -> None:
    try:
        path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    except OSError as error:
        log("SECURITY", f"Не удалось ограничить права файла {path}: {error}")


def get_or_create_secret() -> bytes:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if SECRET_FILE.exists():
        value = SECRET_FILE.read_text(encoding="utf-8").strip()
        if value:
            return value.encode("utf-8")

    secret_value = secrets.token_urlsafe(48)
    SECRET_FILE.write_text(secret_value + "\n", encoding="utf-8")
    _set_private_permissions(SECRET_FILE)
    log("SECURITY", f"Создан ключ целостности {SECRET_FILE}.")
    return secret_value.encode("utf-8")


def make_pin_record(pin: str) -> Dict[str, str]:
    normalized_pin = validate_pin_format(pin)
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", normalized_pin.encode("utf-8"), salt, PIN_ITERATIONS)
    return {
        "settings_pin_salt": base64.urlsafe_b64encode(salt).decode("ascii"),
        "settings_pin_hash": base64.urlsafe_b64encode(digest).decode("ascii"),
    }


def verify_pin(pin: str, security_config: Dict[str, Any]) -> bool:
    try:
        normalized_pin = validate_pin_format(pin)
        salt = base64.urlsafe_b64decode(str(security_config.get("settings_pin_salt", "")))
        expected = base64.urlsafe_b64decode(str(security_config.get("settings_pin_hash", "")))
    except Exception:
        return False

    actual = hashlib.pbkdf2_hmac("sha256", normalized_pin.encode("utf-8"), salt, PIN_ITERATIONS)
    return hmac.compare_digest(actual, expected)


def public_security_config(security_config: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "pin_configured": bool(security_config.get("settings_pin_hash") and security_config.get("settings_pin_salt")),
        "pin_min_length": PIN_MIN_LENGTH,
        "pin_max_length": PIN_MAX_LENGTH,
    }


def _canonical_json(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _signature_payload(config: Dict[str, Any]) -> Dict[str, Any]:
    security = dict(config.get("security") or {})
    security.pop("config_signature", None)
    security.pop("pin_min_length", None)
    security.pop("pin_max_length", None)
    security.pop("pin_configured", None)
    return {
        "settings": config.get("settings") or {},
        "targets": config.get("targets") or [],
        "security": security,
    }


def calculate_config_signature(config: Dict[str, Any]) -> str:
    digest = hmac.new(get_or_create_secret(), _canonical_json(_signature_payload(config)), hashlib.sha256).hexdigest()
    return f"sha256:{digest}"


def attach_config_signature(config: Dict[str, Any]) -> Dict[str, Any]:
    signed_config = json.loads(json.dumps(config, ensure_ascii=False))
    signed_config.setdefault("security", {})
    signed_config["security"]["config_signature"] = calculate_config_signature(signed_config)
    return signed_config


def load_integrity_signature() -> str | None:
    if not INTEGRITY_FILE.exists():
        return None
    try:
        data = json.loads(INTEGRITY_FILE.read_text(encoding="utf-8"))
        signature = data.get("config_signature")
        return str(signature) if signature else None
    except Exception as error:
        raise ConfigTamperError(f"Не удалось прочитать файл контроля целостности: {error}") from error


def save_integrity_signature(signature: str) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "config_signature": signature,
        "algorithm": "hmac-sha256",
        "updated_at": int(time.time()),
    }
    INTEGRITY_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")
    _set_private_permissions(INTEGRITY_FILE)


def assert_config_integrity(config: Dict[str, Any]) -> None:
    embedded = str((config.get("security") or {}).get("config_signature") or "")
    expected = load_integrity_signature()

    if expected and not embedded:
        raise ConfigTamperError("В JSON-конфигурации отсутствует подпись целостности.")
    if expected and embedded != expected:
        raise ConfigTamperError("Подпись JSON-конфигурации не совпадает с контрольной подписью.")
    if not expected and not embedded:
        return

    calculated = calculate_config_signature(config)
    reference = expected or embedded
    if not hmac.compare_digest(calculated, reference):
        raise ConfigTamperError("JSON-конфигурация была изменена вручную или повреждена.")


def ensure_signed_config(config: Dict[str, Any]) -> Dict[str, Any]:
    signed = attach_config_signature(config)
    signature = signed["security"]["config_signature"]
    save_integrity_signature(signature)
    return signed
