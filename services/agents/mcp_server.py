from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

from .weather_monitor import WeatherMonitorAgent
from .weather_notifier import WeatherNotifierAgent

mcp = FastMCP(
    "weather_agents",
    host="0.0.0.0",
    json_response=True,
    transport_security=None,
    streamable_http_path="/",
)

weather_monitor = WeatherMonitorAgent()
weather_notifier = WeatherNotifierAgent()


class _FakeCommand:
    agent = "mcp"
    query = ""
    request_id = "mcp"
    raw: dict[str, Any] = {}
    received_at = ""


@mcp.tool()
async def get_weather() -> dict:
    """Получить текущую погоду в Уфе: температура, влажность, ветер, описание."""
    cmd = _FakeCommand()
    cmd.query = "update"
    result = await weather_monitor.run(cmd)  # type: ignore[arg-type]
    return result


@mcp.tool()
async def send_weather_to_telegram(action: str = "update") -> dict:
    """Отправить или обновить погоду в Telegram.
    action: 'update' — отправить новое сообщение или обновить существующее,
            'reset' — сбросить message_id (следующая отправка создаст новое сообщение).
    """
    cmd = _FakeCommand()
    cmd.query = action
    cmd.raw = {"args": {}}
    result = await weather_notifier.run(cmd)  # type: ignore[arg-type]
    return result


# --- Определение типа медиа по расширению/имени ---

_EXT_TO_METHOD = {
    ".jpg": "sendPhoto", ".jpeg": "sendPhoto", ".png": "sendPhoto",
    ".gif": "sendPhoto", ".webp": "sendPhoto", ".bmp": "sendPhoto",
    ".mp4": "sendVideo", ".avi": "sendVideo", ".mov": "sendVideo",
    ".mkv": "sendVideo", ".webm": "sendVideo",
    ".mp3": "sendAudio", ".wav": "sendAudio", ".flac": "sendAudio",
    ".ogg": "sendVoice", ".oga": "sendVoice",
}

_METHOD_TO_FIELD = {
    "sendPhoto": "photo", "sendVideo": "video",
    "sendAudio": "audio", "sendVoice": "voice", "sendDocument": "document",
}

_SHORT_TO_METHOD = {
    "photo": "sendPhoto", "image": "sendPhoto",
    "video": "sendVideo", "audio": "sendAudio", "music": "sendAudio",
    "voice": "sendVoice", "document": "sendDocument", "file": "sendDocument",
}


def _detect_media_type(url: str, media_type: str = "", file_name: str = "") -> str:
    if media_type:
        m = _SHORT_TO_METHOD.get(media_type.lower())
        if m:
            return m
    target = file_name.lower() if file_name else url.lower()
    for ext, method in _EXT_TO_METHOD.items():
        if target.endswith(ext):
            return method
    for ext, method in _EXT_TO_METHOD.items():
        if url.lower().endswith(ext):
            return method
    return "sendDocument"


@mcp.tool()
async def send_telegram_message(
    text: str,
    file_url: str = "",
    file_name: str = "",
    parse_mode: str = "html",
    action: str = "send",
    media_type: str = "",
) -> str:
    """Universal Telegram sender: text, files, photo, video, audio, voice.
    Parameters:
      text - message text (HTML supported)
      file_url - URL to file (PDF, JPG, PNG, MP4, MP3, OGG, etc.)
      file_name - display filename (used for type detection too)
      parse_mode - html (default), markdownv2, plain
      action - 'send' or 'update' (edit last message)
      media_type - force type: photo/image/video/audio/music/voice/document/file
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return "ERROR: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set"

    if file_url:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as hx:
            resp = await hx.get(file_url)
            resp.raise_for_status()
            file_bytes = resp.content
            ct = resp.headers.get("content-type", "")

        file_type = _detect_media_type(file_url, media_type, file_name)
        field_name = _METHOD_TO_FIELD.get(file_type, "document")
        if not file_name:
            file_name = file_url.split("/")[-1].split("?")[0]

        timeout = httpx.Timeout(60.0)
        data = {"chat_id": chat_id, "caption": text}
        if parse_mode != "plain":
            data["parse_mode"] = parse_mode.upper() if parse_mode == "html" else "MarkdownV2"

        files = {field_name: (file_name, file_bytes)}

        async with httpx.AsyncClient(timeout=timeout) as hx:
            r = await hx.post(f"https://api.telegram.org/bot{token}/{file_type}", data=data, files=files)
            result = r.json()

        if not result.get("ok") and file_type == "sendPhoto":
            desc = result.get("description", "")
            if "can't parse" in desc.lower() or "wrong file" in desc.lower():
                files = {"document": (file_name, file_bytes)}
                async with httpx.AsyncClient(timeout=timeout) as hx:
                    r = await hx.post(f"https://api.telegram.org/bot{token}/sendDocument", data={"chat_id": chat_id, "caption": text}, files=files)
                    result = r.json()

        if not result.get("ok"):
            return f"Error: {result.get('description', 'unknown')}"

        return f"Sent | Type: {file_type} | {file_name}"

    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode.upper() if parse_mode != "plain" else ""}
    async with httpx.AsyncClient(timeout=15.0) as hx:
        r = await hx.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload)
        result = r.json()
    if not result.get("ok"):
        return f"Error: {result.get('description', 'unknown')}"
    return f"Sent (id: {result['result']['message_id']})"


# --- Динамические MCP-инструменты (загрузка через API без передеплоя) ---
# Позволяет добавлять новые MCP-тулы на лету через POST /api/agents/mcp-tools/register
# Код сохраняется в data/agents/mcp_tools/ и восстанавливается при рестарте
#
# Формат кода:
#   async def tool_name(param1: str, param2: int = 0) -> str:
#       """Описание инструмента"""
#       return f"Результат: {param1}, {param2}"

MCP_TOOLS_DIR = Path("data/agents/mcp_tools")
MCP_TOOLS_DIR.mkdir(parents=True, exist_ok=True)

_dynamic_tools: dict[str, dict[str, Any]] = {}

_BUILTIN_TOOLS = frozenset({"get_weather", "send_weather_to_telegram", "send_telegram_message"})


def register_dynamic_tool(name: str, code: str, description: str | None = None) -> dict:
    """Зарегистрировать новый MCP-инструмент из Python-кода.

    Код должен содержать async-функцию с именем, совпадающим с name.
    Параметры функции автоматически становятся inputSchema MCP.
    """
    if not name.isidentifier():
        return {"ok": False, "error": f"Некорректное имя тула: '{name}'. Допустимы только буквы, цифры, underscore."}

    if name in _BUILTIN_TOOLS:
        return {"ok": False, "error": f"Нельзя перезаписать встроенный инструмент: '{name}'"}

    filepath = MCP_TOOLS_DIR / f"{name}.py"
    filepath.write_text(code, encoding="utf-8")

    module_name = f"_mcp_tool_{name}"

    if module_name in sys.modules:
        del sys.modules[module_name]

    try:
        spec = importlib.util.spec_from_file_location(module_name, filepath)
        if not spec or not spec.loader:
            return {"ok": False, "error": "Не удалось создать spec модуля"}
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
    except SyntaxError as e:
        filepath.unlink()
        return {"ok": False, "error": f"Синтаксическая ошибка в коде тула: {e}"}
    except Exception as e:
        filepath.unlink()
        return {"ok": False, "error": f"Не удалось загрузить модуль тула: {e}"}

    fn = getattr(module, name, None)
    if fn is None or not callable(fn):
        filepath.unlink()
        if module_name in sys.modules:
            del sys.modules[module_name]
        return {"ok": False, "error": f"Модуль должен содержать вызываемую функцию с именем '{name}'"}

    if description is None:
        description = getattr(module, "TOOL_DESCRIPTION", fn.__doc__ or f"Динамический MCP-инструмент: {name}")

    try:
        mcp.remove_tool(name)
    except Exception:
        pass

    try:
        mcp.add_tool(fn, name=name, description=description)
    except Exception as e:
        filepath.unlink()
        if module_name in sys.modules:
            del sys.modules[module_name]
        return {"ok": False, "error": f"Не удалось зарегистрировать тул в MCP-сервере: {e}"}

    _dynamic_tools[name] = {"filepath": str(filepath), "description": description}
    return {"ok": True, "result": f"Инструмент '{name}' зарегистрирован"}


def remove_dynamic_tool(name: str) -> dict:
    """Удалить динамический MCP-инструмент."""
    if name in _BUILTIN_TOOLS:
        return {"ok": False, "error": f"Нельзя удалить встроенный инструмент: '{name}'"}

    if name not in _dynamic_tools:
        return {"ok": False, "error": f"Динамический инструмент '{name}' не найден"}

    try:
        mcp.remove_tool(name)
    except Exception:
        pass

    filepath = MCP_TOOLS_DIR / f"{name}.py"
    if filepath.exists():
        filepath.unlink()

    module_name = f"_mcp_tool_{name}"
    if module_name in sys.modules:
        del sys.modules[module_name]

    del _dynamic_tools[name]
    return {"ok": True, "result": f"Инструмент '{name}' удалён"}


def list_dynamic_tools() -> list[dict]:
    """Список всех загруженных динамических MCP-инструментов."""
    result = []
    for name in sorted(_dynamic_tools):
        info = _dynamic_tools[name]
        tool = None
        try:
            tool = mcp._tool_manager.get_tool(name)
        except Exception:
            pass
        entry = {"name": name, "description": info["description"]}
        if tool and hasattr(tool, "inputSchema"):
            entry["input_schema"] = tool.inputSchema
        result.append(entry)
    return result


def load_dynamic_tools() -> None:
    """Восстановить все сохранённые MCP-инструменты с диска (вызывается при старте)."""
    if not MCP_TOOLS_DIR.exists():
        MCP_TOOLS_DIR.mkdir(parents=True, exist_ok=True)
        return

    for filepath in sorted(MCP_TOOLS_DIR.glob("*.py")):
        name = filepath.stem
        if name.startswith("_") or name in _BUILTIN_TOOLS:
            continue
        try:
            code = filepath.read_text(encoding="utf-8")
            result = register_dynamic_tool(name, code)
            if not result.get("ok"):
                print(f"[MCP] Не удалось восстановить инструмент '{name}': {result.get('error')}")
        except Exception as e:
            print(f"[MCP] Ошибка восстановления инструмента '{name}': {e}")


# Восстанавливаем динамические инструменты после предыдущих сессий
load_dynamic_tools()
