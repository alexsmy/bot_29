import httpx
from user_agents import parse
from logger_config import logger # ✨ ИСПРАВЛЕНИЕ: Импортируем наш логгер

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
                # ✨ ИСПРАВЛЕНИЕ: Логируем ошибку от API
                logger.warning(f"IP location API for {ip_address} returned status '{data.get('status')}' with message: {data.get('message')}")
                return {"country": "Error", "city": data.get("message", "Failed request")}
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            # ✨ ИСПРАВЛЕНИЕ: Логируем ошибку сети
            logger.error(f"Error fetching IP location for {ip_address}: {e}")
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