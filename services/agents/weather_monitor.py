from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from .base import AgentCommand

UFA_LAT = 54.74
UFA_LON = 55.97

OPEN_METEO_URL = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={UFA_LAT}&longitude={UFA_LON}"
    f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
    f"&timezone=auto"
)

WMO_CODES = {
    0: "\u2600\ufe0f Ясно",
    1: "\U0001f324 Преимущественно ясно",
    2: "\u26c5 Переменная облачность",
    3: "\u2601\ufe0f Пасмурно",
    45: "\U0001f32b Туман",
    48: "\U0001f32b Иней",
    51: "\U0001f326 Лёгкая морось",
    53: "\U0001f326 Умеренная морось",
    55: "\U0001f326 Сильная морось",
    56: "\U0001f327 Лёгкая ледяная морось",
    57: "\U0001f327 Сильная ледяная морось",
    61: "\U0001f327 Небольшой дождь",
    63: "\U0001f327 Умеренный дождь",
    65: "\U0001f327 Сильный дождь",
    66: "\U0001f327 Небольшой ледяной дождь",
    67: "\U0001f327 Сильный ледяной дождь",
    71: "\U0001f328 Небольшой снег",
    73: "\U0001f328 Умеренный снег",
    75: "\U0001f328 Сильный снег",
    77: "\u2744\ufe0f Снежная крупа",
    80: "\U0001f326 Ливень",
    81: "\U0001f326 Умеренный ливень",
    82: "\U0001f326 Сильный ливень",
    85: "\U0001f328 Снегопад",
    86: "\U0001f328 Сильный снегопад",
    95: "\u26c8 Гроза",
    96: "\u26c8 Гроза с градом",
    99: "\u26c8 Сильная гроза с градом",
}


def _weather_description(code: int) -> str:
    return WMO_CODES.get(code, f"\u2753 Код погоды {code}")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class WeatherMonitorAgent:
    name = "weather_monitor"

    async def run(self, command: AgentCommand) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(OPEN_METEO_URL)
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            return {"ok": False, "error": f"Ошибка получения погоды: {e}"}

        current = data.get("current", {})
        current_units = data.get("current_units", {})

        temp = current.get("temperature_2m")
        feels_like = current.get("apparent_temperature")
        humidity = current.get("relative_humidity_2m")
        wind = current.get("wind_speed_10m")
        weather_code = current.get("weather_code", 0)
        obs_time = current.get("time", _now_iso())

        description = _weather_description(weather_code)

        return {
            "ok": True,
            "city": "Уфа",
            "country": "Россия",
            "observed_at": obs_time,
            "temperature": {
                "value": temp,
                "unit": current_units.get("temperature_2m", "°C"),
                "feels_like": feels_like,
            },
            "humidity": {
                "value": humidity,
                "unit": current_units.get("relative_humidity_2m", "%"),
            },
            "wind": {
                "value": wind,
                "unit": current_units.get("wind_speed_10m", "km/h"),
            },
            "weather": {
                "code": weather_code,
                "description": description,
            },
            "summary": (
                f"{description}, {temp}{current_units.get('temperature_2m', '°C')}"
                f", ощущается как {feels_like}{current_units.get('apparent_temperature', '°C')}"
            ),
            "source": "open-meteo",
            "updated_at": _now_iso(),
        }
