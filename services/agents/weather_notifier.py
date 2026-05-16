from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx

from .base import AgentCommand

TELEGRAM_API_BASE = "https://api.telegram.org"
WEATHER_DATA_DIR = Path("data/weather")
MESSAGE_ID_FILE = WEATHER_DATA_DIR / "telegram_message_id.txt"


class WeatherNotifierAgent:
    name = "weather_notifier"

    async def run(self, command: AgentCommand) -> dict[str, Any]:
        query = command.query.strip().lower()
        weather = command.raw.get("args", {})

        if query == "reset":
            self._reset_message_id()
            return {"ok": True, "action": "reset", "message": "message_id сброшен. Следующая отправка создаст новое сообщение."}

        if not weather:
            weather = self._read_stored_weather()
            if not weather:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.get(
                            "https://api.open-meteo.com/v1/forecast"
                            "?latitude=54.74&longitude=55.97"
                            "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
                            "&timezone=auto"
                        )
                        resp.raise_for_status()
                        weather = resp.json().get("current", {})
                        weather["_units"] = resp.json().get("current_units", {})
                except Exception as e:
                    return {"ok": False, "error": f"Не удалось получить погоду: {e}"}

        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
        if not bot_token or not chat_id:
            return {"ok": False, "error": "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы."}

        text = self._format_message(weather)
        stored_message_id = self._read_message_id()

        if stored_message_id and query != "send":
            result = await self._edit_message(bot_token, chat_id, stored_message_id, text)
            if result.get("ok"):
                return result
            self._reset_message_id()

        result = await self._send_message(bot_token, chat_id, text)
        if result.get("ok"):
            mid = result.get("message_id")
            if mid:
                self._write_message_id(mid)
        return result

    def _format_message(self, weather: dict) -> str:
        units = weather.get("_units", {})
        temp = weather.get("temperature_2m", "?")
        feels = weather.get("apparent_temperature", "?")
        hum = weather.get("relative_humidity_2m", "?")
        wind = weather.get("wind_speed_10m", "?")
        code = weather.get("weather_code", 0)
        time_str = weather.get("time", "")
        t_unit = units.get("temperature_2m", "°C")
        h_unit = units.get("relative_humidity_2m", "%")
        w_unit = units.get("wind_speed_10m", "km/h")
        desc = self._weather_description(code)
        return (
            f"\U0001f30d <b>Погода в Уфе</b>\n"
            f"\U0001f550 {time_str}\n\n"
            f"{desc}\n"
            f"\U0001f321 <b>{temp}{t_unit}</b> (ощущается как {feels}{t_unit})\n"
            f"\U0001f4a7 Влажность: {hum}{h_unit}\n"
            f"\U0001f4a8 Ветер: {wind}{w_unit}\n\n"
            f"\U0001f916 <i>weather_notifier agent</i>"
        )

    async def _send_message(self, token: str, chat_id: str, text: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(f"{TELEGRAM_API_BASE}/bot{token}/sendMessage", json={
                    "chat_id": chat_id, "text": text, "parse_mode": "HTML",
                })
                data = resp.json()
                if data.get("ok"):
                    mid = data["result"]["message_id"]
                    return {"ok": True, "action": "sent", "message_id": mid}
                return {"ok": False, "error": data.get("description", "Unknown")}
        except Exception as e:
            return {"ok": False, "error": f"Ошибка отправки: {e}"}

    async def _edit_message(self, token: str, chat_id: str, message_id: int, text: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(f"{TELEGRAM_API_BASE}/bot{token}/editMessageText", json={
                    "chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML",
                })
                data = resp.json()
                if data.get("ok"):
                    return {"ok": True, "action": "edited", "message_id": message_id}
                return {"ok": False, "detail": data.get("description", "Unknown"), "message_id": message_id}
        except Exception as e:
            return {"ok": False, "detail": f"Ошибка редактирования: {e}", "message_id": message_id}

    def _weather_description(self, code: int) -> str:
        codes = {
            0: "\u2600\ufe0f Ясно", 1: "\U0001f324 Преимущественно ясно",
            2: "\u26c5 Переменная облачность", 3: "\u2601\ufe0f Пасмурно",
            45: "\U0001f32b Туман", 48: "\U0001f32b Иней",
            51: "\U0001f326 Лёгкая морось", 53: "\U0001f326 Умеренная морось",
            55: "\U0001f326 Сильная морось", 61: "\U0001f327 Небольшой дождь",
            63: "\U0001f327 Умеренный дождь", 65: "\U0001f327 Сильный дождь",
            71: "\U0001f328 Небольшой снег", 73: "\U0001f328 Умеренный снег",
            75: "\U0001f328 Сильный снег", 80: "\U0001f326 Ливень",
            81: "\U0001f326 Умеренный ливень", 82: "\U0001f326 Сильный ливень",
            85: "\U0001f328 Снегопад", 86: "\U0001f328 Сильный снегопад",
            95: "\u26c8 Гроза", 96: "\u26c8 Гроза с градом", 99: "\u26c8 Сильная гроза с градом",
        }
        return codes.get(code, f"\u2753 Код {code}")

    def _read_stored_weather(self) -> dict | None:
        try:
            path = WEATHER_DATA_DIR / "latest.json"
            if path.exists():
                import json
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
        return None

    def _read_message_id(self) -> int | None:
        try:
            if MESSAGE_ID_FILE.exists():
                return int(MESSAGE_ID_FILE.read_text(encoding="utf-8").strip())
        except (ValueError, OSError):
            pass
        return None

    def _write_message_id(self, message_id: int) -> None:
        WEATHER_DATA_DIR.mkdir(parents=True, exist_ok=True)
        MESSAGE_ID_FILE.write_text(str(message_id), encoding="utf-8")

    def _reset_message_id(self) -> None:
        try:
            if MESSAGE_ID_FILE.exists():
                MESSAGE_ID_FILE.unlink()
        except OSError:
            pass
