import httpx
import hmac
import hashlib
import json
from typing import Optional, Dict, Any
from urllib.parse import parse_qsl

from user_agents import parse
from config import BOT_TOKEN
from logger_config import logger

async def get_ip_location(ip_address: str) -> dict:
    """Fetches geolocation data for a given IP address."""
    if not ip_address or ip_address in ["127.0.0.1", "localhost"]:
        return {"country": "Local", "city": "Host"}

    url = f"http://ip-api.com/json/{ip_address}?fields=status,message,country,city"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=2.0)
            response.raise_for_status()
            data = response.json()
            if data.get("status") == "success":
                return {
                    "country": data.get("country", "Unknown"),
                    "city": data.get("city", "Unknown")
                }
            else:
                return {"country": "Error", "city": data.get("message", "Failed request")}
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            print(f"Error fetching IP location for {ip_address}: {e}")
            return {"country": "N/A", "city": "N/A"}

def parse_user_agent(user_agent_string: str) -> dict:
    """Parses a User-Agent string into a readable format."""
    if not user_agent_string:
        return {"device": "Unknown", "os": "Unknown", "browser": "Unknown"}

    ua = parse(user_agent_string)

    device_type = "Desktop"
    if ua.is_mobile:
        device_type = "Mobile"
    elif ua.is_tablet:
        device_type = "Tablet"
    elif ua.is_bot:
        device_type = "Bot"

    return {
        "device": device_type,
        "os": f"{ua.os.family} {ua.os.version_string}".strip(),
        "browser": f"{ua.browser.family} {ua.browser.version_string}".strip()
    }

# --- НАЧАЛО ИЗМЕНЕНИЙ ---

async def validate_init_data(init_data_str: str) -> Optional[Dict[str, Any]]:
    """
    Валидирует строку initData, полученную от Telegram Mini App.
    Возвращает словарь с данными пользователя в случае успеха, иначе None.
    """
    if not BOT_TOKEN:
        logger.critical("Невозможно валидировать initData: BOT_TOKEN не установлен.")
        return None

    try:
        parsed_data = dict(parse_qsl(init_data_str))
    except Exception:
        logger.warning(f"Не удалось распарсить initData: {init_data_str}")
        return None

    if "hash" not in parsed_data:
        logger.warning(f"В initData отсутствует hash: {parsed_data}")
        return None

    hash_from_telegram = parsed_data.pop("hash")
    
    # Сортируем ключи и формируем строку для проверки
    sorted_items = sorted(parsed_data.items())
    data_check_string = "\n".join([f"{k}={v}" for k, v in sorted_items])

    # Вычисляем хеш
    secret_key = hmac.new("WebAppData".encode(), BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if calculated_hash == hash_from_telegram:
        logger.info(f"initData успешно валидирована для пользователя: {parsed_data.get('user')}")
        user_data_json = parsed_data.get("user")
        if user_data_json:
            return json.loads(user_data_json)
        return {}
    else:
        logger.warning(f"Ошибка валидации initData. Hash не совпадает. Получено: {hash_from_telegram}, вычислено: {calculated_hash}")
        return None

# --- КОНЕЦ ИЗМЕНЕНИЙ ---