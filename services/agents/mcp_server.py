from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from .weather_monitor import WeatherMonitorAgent
from .weather_notifier import WeatherNotifierAgent

mcp = FastMCP("weather_agents", json_response=True)

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
