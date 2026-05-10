from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any, Dict

from fastapi import HTTPException, Request, Response, status

from config.config_manager import load_advanced_config
from config.keepalive_security import AUTH_COOKIE_NAME, TOKEN_TTL_SECONDS, get_or_create_secret, verify_pin
from utils.logger import log

FIRST_FAILURE_DELAY_SECONDS = 5
REPEATED_FAILURE_DELAY_SECONDS = 60
MAX_IDENTITY_LENGTH = 160


@dataclass
class AttemptState:
    failures: int = 0
    locked_until: float = 0.0
    last_seen: float = 0.0


_attempts: dict[str, AttemptState] = {}


def _now() -> float:
    return time.time()


def _client_identity(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    host = forwarded or (request.client.host if request.client else "unknown")
    user_agent = request.headers.get("user-agent", "unknown")[:MAX_IDENTITY_LENGTH]
    digest = hashlib.sha256(f"{host}|{user_agent}".encode("utf-8")).hexdigest()[:16]
    return f"{host}:{digest}"


def _cleanup_attempts() -> None:
    current = _now()
    stale_keys = [key for key, state in _attempts.items() if current - state.last_seen > 24 * 60 * 60]
    for key in stale_keys:
        _attempts.pop(key, None)


def _attempt_status(identity: str) -> Dict[str, Any]:
    state = _attempts.get(identity)
    current = _now()
    if not state:
        return {"locked": False, "retry_after_seconds": 0, "failures": 0}

    retry_after = max(0, int(round(state.locked_until - current)))
    if retry_after <= 0 and state.failures == 0:
        _attempts.pop(identity, None)
        return {"locked": False, "retry_after_seconds": 0, "failures": 0}

    return {"locked": retry_after > 0, "retry_after_seconds": retry_after, "failures": state.failures}


def get_pin_attempt_status(request: Request) -> Dict[str, Any]:
    _cleanup_attempts()
    return _attempt_status(_client_identity(request))


def _register_failed_attempt(identity: str) -> Dict[str, Any]:
    current = _now()
    state = _attempts.setdefault(identity, AttemptState())
    state.failures += 1
    state.last_seen = current
    delay = FIRST_FAILURE_DELAY_SECONDS if state.failures == 1 else REPEATED_FAILURE_DELAY_SECONDS
    state.locked_until = current + delay
    log("SECURITY", f"Ошибка ввода PIN для keep-alive настроек. Блокировка на {delay} сек.")
    return _attempt_status(identity)


def _register_success(identity: str) -> None:
    _attempts.pop(identity, None)


def _base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unbase64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _token_signature(payload: str) -> str:
    digest = hmac.new(get_or_create_secret(), payload.encode("utf-8"), hashlib.sha256).digest()
    return _base64url(digest)


def create_auth_token() -> str:
    payload = {
        "scope": "keepalive-settings",
        "exp": int(_now()) + TOKEN_TTL_SECONDS,
    }
    encoded_payload = _base64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _token_signature(encoded_payload)
    return f"{encoded_payload}.{signature}"


def is_token_valid(token: str | None) -> bool:
    if not token or "." not in token:
        return False

    encoded_payload, signature = token.rsplit(".", 1)
    expected_signature = _token_signature(encoded_payload)
    if not hmac.compare_digest(signature, expected_signature):
        return False

    try:
        payload = json.loads(_unbase64url(encoded_payload).decode("utf-8"))
    except Exception:
        return False

    return payload.get("scope") == "keepalive-settings" and int(payload.get("exp", 0)) >= int(_now())


def set_auth_cookie(response: Response, token: str, *, secure: bool = False) -> None:
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        max_age=TOKEN_TTL_SECONDS,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/api/keepalive",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(AUTH_COOKIE_NAME, path="/api/keepalive")


def require_settings_auth(request: Request) -> None:
    if not is_token_valid(request.cookies.get(AUTH_COOKIE_NAME)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется ввод PIN-кода для настроек.")


def authenticate_pin(request: Request, pin: str) -> Dict[str, Any]:
    _cleanup_attempts()
    identity = _client_identity(request)
    status_payload = _attempt_status(identity)
    if status_payload["locked"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Слишком много попыток. Повторите через {status_payload['retry_after_seconds']} сек.",
            headers={"Retry-After": str(status_payload["retry_after_seconds"])},
        )

    config = load_advanced_config(strict_integrity=True)
    if not verify_pin(pin, config.get("security") or {}):
        failed_status = _register_failed_attempt(identity)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Неверный PIN-код. Повторите через {failed_status['retry_after_seconds']} сек.",
            headers={"Retry-After": str(failed_status["retry_after_seconds"])},
        )

    _register_success(identity)
    return {"ok": True, "expires_in_seconds": TOKEN_TTL_SECONDS}
