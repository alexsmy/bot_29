import os
import sys

BOT_TOKEN = os.environ.get("BOT_TOKEN")
BOT_NAME = os.environ.get("BOT_NAME", "Telegram Caller")
BOT_USERNAME = os.environ.get("BOT_USERNAME", "")
ADMIN_USER_ID = os.environ.get("ADMIN_USER_ID")

WEB_APP_URL = os.environ.get("WEB_APP_URL", "http://localhost:8000")
if WEB_APP_URL and not WEB_APP_URL.startswith("http"):
    WEB_APP_URL = "https://" + WEB_APP_URL

if not WEB_APP_URL.endswith('/'):
    WEB_APP_URL += '/'

ICE_SERVERS_CONFIG_FILE = "ice_servers.json"
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
XIRSYS_IDENT = os.environ.get("XIRSYS_IDENT")
XIRSYS_SECRET = os.environ.get("XIRSYS_SECRET")
COTURN_HOST = os.environ.get("COTURN_HOST")
COTURN_USER = os.environ.get("COTURN_USER")
COTURN_SECRET = os.environ.get("COTURN_SECRET")

PRIVATE_ROOM_LIFETIME_HOURS = 3
ADMIN_TOKEN_LIFETIME_MINUTES = 60

ADMIN_ROOM_LIFETIME_1_HOUR = 1
ADMIN_ROOM_LIFETIME_1_DAY = 24
ADMIN_ROOM_LIFETIME_1_MONTH = 24 * 30
ADMIN_ROOM_LIFETIME_1_YEAR = 24 * 365

if not BOT_TOKEN:
    print("КРИТИЧЕСКАЯ ОШИБКА: Токен бота (BOT_TOKEN) не найден в переменных окружения.", file=sys.stderr)
    sys.exit(1)```

Это исправление гарантирует, что URL для Mini App всегда будет иметь правильный формат `https://...`, что решит проблему с запуском. После применения этого изменения, пожалуйста, перезапусти приложение. Команда `/start` должна заработать корректно.