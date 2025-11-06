import httpx
import hmac
import hashlib
import os
from urllib.parse import parse_qsl
from user_agents import parse
from logger_config import logger

def validate_init_data(init_data: str) -> bool:
    bot_token = os.environ.get("BOT_TOKEN")
    if not bot_token:
        logger.error("[VALIDATION DEBUG] BOT_TOKEN is not available in environment.")
        return False

    logger.info(f"[VALIDATION DEBUG] Using token starting with: {bot_token[:4]}...{bot_token[-4:]}")

    try:
        parsed_data = dict(parse_qsl(init_data))
    except ValueError:
        logger.error("[VALIDATION DEBUG] Could not parse initData.")
        return False

    if "hash" not in parsed_data:
        logger.error("[VALIDATION DEBUG] 'hash' not found in initData.")
        return False

    hash_from_telegram = parsed_data.pop("hash")

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(parsed_data.items())
    )
    
    logger.info(f"[VALIDATION DEBUG] Data Check String: {data_check_string[:100]}...")

    secret_key = hmac.new(
        "WebAppData".encode(), bot_token.encode(), hashlib.sha256
    ).digest()
    
    calculated_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    is_valid = calculated_hash == hash_from_telegram
    
    if not is_valid:
        logger.warning(f"[VALIDATION DEBUG] HASH MISMATCH!")
        logger.warning(f"[VALIDATION DEBUG]   Telegram Hash: {hash_from_telegram}")
        logger.warning(f"[VALIDATION DEBUG] Calculated Hash: {calculated_hash}")

    return is_valid

async def get_ip_location(ip_address: str) -> dict:
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