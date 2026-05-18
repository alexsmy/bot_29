# Сервис отправки сообщений в Telegram через прямой Bot API.
# Используется эндпоинтом /mytelegram (GET/POST).
# Поддерживает: single (отправить), replace (редактировать), temporary (отправить + удалить).
# Форматы: HTML, MarkdownV2, plain.
# Все параметры (токен, chat_id, секрет) — из переменных окружения.

from __future__ import annotations

import asyncio
import base64
import hmac
import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from fastapi import HTTPException, Request, status

from utils.logger import log

TELEGRAM_API_BASE = "https://api.telegram.org"
DEFAULT_TIMEOUT_SECONDS = 15.0
MAX_SAFE_MESSAGE_LENGTH = 3900

ParseMode = Literal["HTML", "MarkdownV2", ""]
MessageKind = Literal["single", "replace", "temporary"]


@dataclass(slots=True)
class TelegramTunnelSettings:
    bot_token: str
    chat_id: str
    secret: str | None
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    delete_after_seconds: int = 0


def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on", "y"}


def _int_or_default(value: Any, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default

    if minimum is not None:
        result = max(result, minimum)
    if maximum is not None:
        result = min(result, maximum)
    return result


def _float_or_default(value: Any, default: float, minimum: float | None = None, maximum: float | None = None) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        result = default

    if minimum is not None:
        result = max(result, minimum)
    if maximum is not None:
        result = min(result, maximum)
    return result


def load_tunnel_settings() -> TelegramTunnelSettings:
    """
    Загружает чувствительные параметры Telegram только из переменных окружения.
    Это не хранит токен и chat_id в репозитории и подходит для Render.
    """
    bot_token = str(os.environ.get("TELEGRAM_BOT_TOKEN", "")).strip()
    chat_id = str(os.environ.get("TELEGRAM_CHAT_ID", "")).strip()
    secret = str(os.environ.get("TELEGRAM_TUNNEL_SECRET", "")).strip() or None

    timeout_seconds = _float_or_default(os.environ.get("TELEGRAM_TUNNEL_TIMEOUT_SECONDS"), DEFAULT_TIMEOUT_SECONDS, minimum=3.0, maximum=60.0)
    delete_after_seconds = _int_or_default(
        os.environ.get("TELEGRAM_TUNNEL_DELETE_AFTER_SECONDS"),
        0,
        minimum=0,
        maximum=24 * 60 * 60,
    )

    return TelegramTunnelSettings(
        bot_token=bot_token,
        chat_id=chat_id,
        secret=secret,
        timeout_seconds=timeout_seconds,
        delete_after_seconds=delete_after_seconds,
    )


def _escape_markdown_v2(text: str) -> str:
    # Специальные символы по правилам Telegram MarkdownV2.
    escape_chars = r"_*[]()~`>#+-=|{}.!\\"
    result = []
    for char in text:
        if char in escape_chars:
            result.append(f"\\{char}")
        else:
            result.append(char)
    return "".join(result)


def _normalize_format(raw_value: Any) -> tuple[ParseMode, str]:
    value = str(raw_value or "html").strip().lower()
    if value in {"html", "htm"}:
        return "HTML", "html"
    if value in {"markdownv2", "markdown_v2", "mdv2"}:
        return "MarkdownV2", "markdownv2"
    if value in {"markdown", "md"}:
        # Telegram всё ещё поддерживает legacy Markdown, но MarkdownV2 надёжнее.
        return "MarkdownV2", "markdown"
    if value in {"plain", "text", "none", ""}:
        return "", "plain"
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Поле format должно быть одним из: html, markdownv2, plain.",
    )


def _normalize_kind(raw_value: Any) -> MessageKind:
    value = str(raw_value or "single").strip().lower()
    if value in {"single", "send", "message"}:
        return "single"
    if value in {"replace", "edit", "update"}:
        return "replace"
    if value in {"temporary", "temp", "ephemeral"}:
        return "temporary"
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Поле kind должно быть одним из: single, replace, temporary.",
    )


def _normalize_payload(raw_payload: Any) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ожидался JSON-объект с полями сообщения.",
        )

    text = str(raw_payload.get("text") or raw_payload.get("message") or "").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Поле text не должно быть пустым.",
        )

    parse_mode, parse_mode_label = _normalize_format(raw_payload.get("format") or raw_payload.get("parse_mode"))
    kind = _normalize_kind(raw_payload.get("kind"))
    disable_web_page_preview = _boolish(raw_payload.get("disable_web_page_preview", True))

    message_id = raw_payload.get("message_id")
    reply_to_message_id = raw_payload.get("reply_to_message_id")
    delete_after_seconds = _int_or_default(
        raw_payload.get("delete_after_seconds"),
        0,
        minimum=0,
        maximum=24 * 60 * 60,
    )

    normalized: dict[str, Any] = {
        "text": text,
        "format": parse_mode_label,
        "parse_mode": parse_mode,
        "kind": kind,
        "disable_web_page_preview": disable_web_page_preview,
        "delete_after_seconds": delete_after_seconds,
    }

    if message_id not in (None, "", "null"):
        normalized["message_id"] = _int_or_default(message_id, 0, minimum=1)
    if reply_to_message_id not in (None, "", "null"):
        normalized["reply_to_message_id"] = _int_or_default(reply_to_message_id, 0, minimum=1)

    return normalized


def _parse_query_payload(request: Request) -> dict[str, Any]:
    params = dict(request.query_params)

    if "payload" in params:
        try:
            return json.loads(params["payload"])
        except json.JSONDecodeError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Не удалось распарсить payload как JSON: {error}",
            ) from error

    if "data" in params:
        try:
            padded = params["data"] + "=" * (-len(params["data"]) % 4)
            decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
            return json.loads(decoded)
        except Exception as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Не удалось распарсить data как base64 JSON: {error}",
            ) from error

    if "text" in params:
        return {
            "text": params.get("text", ""),
            "format": params.get("format", "html"),
            "kind": params.get("kind", "single"),
            "disable_web_page_preview": params.get("disable_web_page_preview", "true"),
            "delete_after_seconds": params.get("delete_after_seconds", 0),
            "message_id": params.get("message_id"),
            "reply_to_message_id": params.get("reply_to_message_id"),
        }

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Передайте payload, data или text в query string, либо JSON в теле запроса.",
    )


async def read_incoming_payload(request: Request) -> dict[str, Any]:
    if request.method.upper() == "POST":
        content_type = (request.headers.get("content-type") or "").lower()
        if "application/json" in content_type:
            try:
                body = await request.json()
                if isinstance(body, dict):
                    return body
            except Exception as error:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Не удалось прочитать JSON-тело запроса: {error}",
                ) from error

    return _parse_query_payload(request)


def _require_secret(request: Request, settings: TelegramTunnelSettings) -> None:
    if not settings.secret:
        return

    provided = (
        request.headers.get("x-telegram-tunnel-secret")
        or request.headers.get("x-tunnel-secret")
        or request.query_params.get("secret")
        or ""
    )
    if not hmac.compare_digest(str(provided), settings.secret):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Неверный секрет туннеля.",
        )


def _prepare_text(payload: dict[str, Any]) -> str:
    text = payload["text"]
    parse_mode = payload["parse_mode"]

    if parse_mode == "":
        return text

    if parse_mode == "MarkdownV2":
        if payload["format"] == "markdown":
            return _escape_markdown_v2(text)
        return text

    return text


async def _telegram_api_call(method: str, payload: dict[str, Any], settings: TelegramTunnelSettings) -> dict[str, Any]:
    if not settings.bot_token or not settings.chat_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="На сервере не заданы TELEGRAM_BOT_TOKEN и/или TELEGRAM_CHAT_ID.",
        )

    url = f"{TELEGRAM_API_BASE}/bot{settings.bot_token}/{method}"
    timeout = httpx.Timeout(settings.timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)

    try:
        data = response.json()
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Telegram вернул не-JSON ответ: {error}",
        ) from error

    if response.is_error or not data.get("ok", False):
        description = data.get("description") or response.text
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Telegram API error: {description}",
        )

    return data


def _extract_message_id(result: Any) -> int | None:
    if isinstance(result, dict):
        message_id = result.get("message_id")
        if isinstance(message_id, int):
            return message_id
        if isinstance(result.get("result"), dict):
            nested_message_id = result["result"].get("message_id")
            if isinstance(nested_message_id, int):
                return nested_message_id
    return None


async def _delete_message_later(settings: TelegramTunnelSettings, message_id: int, delay_seconds: int) -> None:
    if delay_seconds <= 0:
        return

    await asyncio.sleep(delay_seconds)

    try:
        await _telegram_api_call(
            "deleteMessage",
            {
                "chat_id": settings.chat_id,
                "message_id": message_id,
            },
            settings,
        )
        log("TELEGRAM", f"Сообщение {message_id} удалено по таймеру.")
    except Exception as error:
        log("ERROR", f"Не удалось удалить временное сообщение {message_id}: {error}", level=logging.WARNING)


async def send_tunnel_message(request: Request, raw_payload: dict[str, Any]) -> dict[str, Any]:
    settings = load_tunnel_settings()
    _require_secret(request, settings)

    payload = _normalize_payload(raw_payload)
    text = _prepare_text(payload)

    if len(text) > MAX_SAFE_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Сообщение слишком длинное для безопасной отправки одним запросом.",
        )

    base_payload: dict[str, Any] = {
        "chat_id": settings.chat_id,
        "text": text,
        "disable_web_page_preview": payload["disable_web_page_preview"],
    }

    if payload["parse_mode"]:
        base_payload["parse_mode"] = payload["parse_mode"]

    if payload["kind"] == "replace":
        message_id = payload.get("message_id")
        if not message_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Для kind=replace нужно передать message_id.",
            )

        telegram_result = await _telegram_api_call(
            "editMessageText",
            {
                **base_payload,
                "message_id": message_id,
            },
            settings,
        )
        message_id_result = _extract_message_id(telegram_result) or int(message_id)
        action = "edited"
    else:
        if payload.get("reply_to_message_id"):
            base_payload["reply_to_message_id"] = payload["reply_to_message_id"]

        telegram_result = await _telegram_api_call("sendMessage", base_payload, settings)
        message_id_result = _extract_message_id(telegram_result)
        action = "sent"

    if payload["kind"] == "temporary":
        delay_seconds = payload["delete_after_seconds"] or settings.delete_after_seconds
        if message_id_result and delay_seconds > 0:
            asyncio.create_task(_delete_message_later(settings, message_id_result, delay_seconds))

    result = {
        "ok": True,
        "action": action,
        "kind": payload["kind"],
        "format": payload["format"],
        "chat_id": settings.chat_id,
        "message_id": message_id_result,
        "delete_after_seconds": payload["delete_after_seconds"] or settings.delete_after_seconds,
        "server": "render",
    }

    log("TELEGRAM", f"Сообщение отправлено: action={action}, kind={payload['kind']}, message_id={message_id_result}")
    return result


async def tunnel_status() -> dict[str, Any]:
    settings = load_tunnel_settings()
    return {
        "ok": True,
        "configured": bool(settings.bot_token and settings.chat_id),
        "secret_required": bool(settings.secret),
        "timeout_seconds": settings.timeout_seconds,
        "delete_after_seconds": settings.delete_after_seconds,
        "max_message_length": MAX_SAFE_MESSAGE_LENGTH,
    }
