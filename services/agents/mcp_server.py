"""
# MCP-сервер погодных агентов + динамические инструменты

## Что это
Это FastMCP-сервер, который монтируется в FastAPI на /mcp.
Через него opencode (и любой MCP-клиент) может:
  - получать погоду в Уфе (get_weather)
  - отправлять погоду в Telegram (send_weather_to_telegram)
  - загружать свои MCP-инструменты на лету без передеплоя (через API)

## Как это работает
1. FastMCP создаёт HTTP-приложение (SSE + JSON-RPC)
2. FastAPI монтирует его на /mcp через lifespan + streamable_http_app()
3. Opencode в opencode.jsonc подключается к https://bot_29/mcp как remote MCP
4. Динамические инструменты сохраняются в data/agents/mcp_tools/*.py
5. При рестарте сервера они восстанавливаются автоматически

## Как добавить свой инструмент
Смотри примеры в agents-hub/mcp_tools_examples/
Загрузить: POST /api/agents/mcp-tools/register
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

from .weather_monitor import WeatherMonitorAgent
from .weather_notifier import WeatherNotifierAgent

# --- Создаём MCP-сервер ---
# FastMCP автоматически создаёт JSON-RPC эндпоинт с SSE-транспортом
# streamable_http_path="/" — монтируем в корень FastMCP-приложения
mcp = FastMCP(
    "weather_agents",
    host="0.0.0.0",
    json_response=True,
    transport_security=None,
    streamable_http_path="/",
)

# Экземпляры погодных агентов (они же используются старым ALM-протоколом)
weather_monitor = WeatherMonitorAgent()
weather_notifier = WeatherNotifierAgent()


class _FakeCommand:
    """
    Заглушка для совместимости MCP-тулов с ALM-агентами.
    Обычные ALM-агенты получают AgentCommand (query, args, raw...).
    MCP-тулы получают только свои параметры.
    _FakeCommand подставляет минимально необходимые поля,
    чтобы MCP-тул мог вызвать метод run() существующего ALM-агента.
    """
    agent = "mcp"
    query = ""
    request_id = "mcp"
    raw: dict[str, Any] = {}
    received_at = ""


# ============================================================
# ВСТРОЕННЫЕ MCP-ИНСТРУМЕНТЫ
# ============================================================
# Эти инструменты всегда доступны, их нельзя удалить или перезаписать

@mcp.tool()
async def get_weather() -> dict:
    """
    Получить текущую погоду в Уфе: температура, влажность, ветер, описание.
    Данные из Open-Meteo API (бесплатно, без ключа).
    """
    cmd = _FakeCommand()
    cmd.query = "update"
    result = await weather_monitor.run(cmd)
    return result


@mcp.tool()
async def send_weather_to_telegram(action: str = "update") -> dict:
    """
    Отправить или обновить погоду в Telegram.
    Параметры:
      action: 'update' — отправить новое сообщение или обновить существующее,
              'reset' — сбросить message_id (следующая отправка создаст новое сообщение).
    """
    cmd = _FakeCommand()
    cmd.query = action
    cmd.raw = {"args": {}}
    result = await weather_notifier.run(cmd)
    return result


# ============================================================
# ДИНАМИЧЕСКИЕ MCP-ИНСТРУМЕНТЫ
# ============================================================
# Загружаются через POST /api/agents/mcp-tools/register
# Код сохраняется в data/agents/mcp_tools/{name}.py
# Восстанавливаются при рестарте сервера автоматически
#
# Формат кода инструмента:
#   async def tool_name(param1: str, param2: int = 0) -> str:
#       """Описание инструмента (станет description в MCP tools/list)"""
#       return f"Результат: {param1}, {param2}"
#
# Параметры функции → inputSchema MCP (типы, значения по умолчанию)

MCP_TOOLS_DIR = Path("data/agents/mcp_tools")
MCP_TOOLS_DIR.mkdir(parents=True, exist_ok=True)

_dynamic_tools: dict[str, dict[str, Any]] = {}

_BUILTIN_TOOLS = frozenset({"get_weather", "send_weather_to_telegram"})


def register_dynamic_tool(name: str, code: str, description: str | None = None) -> dict:
    """
    Зарегистрировать новый MCP-инструмент из Python-кода.

    Аргументы:
      name — имя инструмента (должно быть валидным Python-идентификатором)
      code — Python-код с async-функцией,同名 name
      description — описание (если не указано, берётся из docstring функции)

    Возвращает:
      {"ok": true} или {"ok": false, "error": "..."}
    """
    # Проверка имени
    if not name.isidentifier():
        return {"ok": False, "error": f"Некорректное имя тула: '{name}'. "
                                      "Допустимы только буквы, цифры, underscore."}

    # Защита встроенных инструментов
    if name in _BUILTIN_TOOLS:
        return {"ok": False, "error": f"Нельзя перезаписать встроенный инструмент: '{name}'"}

    # Сохраняем код на диск (для восстановления после рестарта)
    filepath = MCP_TOOLS_DIR / f"{name}.py"
    filepath.write_text(code, encoding="utf-8")

    # Динамически импортируем код
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

    # Ищем функцию с именем name
    fn = getattr(module, name, None)
    if fn is None or not callable(fn):
        filepath.unlink()
        if module_name in sys.modules:
            del sys.modules[module_name]
        return {"ok": False, "error": f"Модуль должен содержать вызываемую функцию с именем '{name}'"}

    # Определяем описание
    if description is None:
        description = getattr(module, "TOOL_DESCRIPTION", fn.__doc__ or f"Динамический MCP-инструмент: {name}")

    # Удаляем старую версию, если была
    try:
        mcp.remove_tool(name)
    except Exception:
        pass

    # Регистрируем в FastMCP
    # FastMCP сам читает аннотации типов параметров → inputSchema
    mcp.tool(name=name, description=description)(fn)

    _dynamic_tools[name] = {
        "name": name,
        "description": description,
        "file": str(filepath),
    }

    return {"ok": True, "action": "registered", "tool": name}


def remove_dynamic_tool(name: str) -> dict:
    """
    Удалить загруженный MCP-инструмент.
    """
    if name in _BUILTIN_TOOLS:
        return {"ok": False, "error": f"Нельзя удалить встроенный инструмент: '{name}'"}

    if name not in _dynamic_tools:
        return {"ok": False, "error": f"Инструмент '{name}' не найден"}

    try:
        mcp.remove_tool(name)
    except Exception as e:
        return {"ok": False, "error": f"Ошибка удаления из MCP: {e}"}

    # Удаляем файл с диска
    filepath = MCP_TOOLS_DIR / f"{name}.py"
    if filepath.exists():
        filepath.unlink()

    # Очищаем модуль
    module_name = f"_mcp_tool_{name}"
    if module_name in sys.modules:
        del sys.modules[module_name]

    del _dynamic_tools[name]

    return {"ok": True, "action": "removed", "tool": name}


def list_dynamic_tools() -> list[dict[str, Any]]:
    """
    Список всех загруженных динамических MCP-инструментов.
    """
    return list(_dynamic_tools.values())


def load_dynamic_tools() -> None:
    """
    Восстановить динамические инструменты с диска.
    Вызывается при старте сервера.
    """
    if not MCP_TOOLS_DIR.exists():
        return

    for filepath in sorted(MCP_TOOLS_DIR.glob("*.py")):
        name = filepath.stem
        # Пропускаем системные файлы и встроенные инструменты
        if name.startswith("_") or name in _BUILTIN_TOOLS:
            continue
        try:
            code = filepath.read_text(encoding="utf-8")
            result = register_dynamic_tool(name, code)
            if not result.get("ok"):
                print(f"[MCP] Не удалось восстановить инструмент '{name}': "
                      f"{result.get('error')}")
        except Exception as e:
            print(f"[MCP] Ошибка восстановления инструмента '{name}': {e}")


# Восстанавливаем динамические инструменты после предыдущих сессий
load_dynamic_tools()
