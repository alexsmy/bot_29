import os
import sys


BOT_TOKEN = os.environ.get("BOT_TOKEN")
BOT_NAME = os.environ.get("BOT_NAME", "Telegram Caller")
BOT_USERNAME = os.environ.get("BOT_USERNAME", "")
ADMIN_USER_ID = os.environ.get("ADMIN_USER_ID")

WEB_APP_URL = os.environ.get("WEB_APP_URL", "http://localhost:8000")
if not WEB_APP_URL.endswith('/'):
    WEB_APP_URL += '/'

ICE_SERVERS_CONFIG_FILE = "ice_servers.json"
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")

PRIVATE_ROOM_LIFETIME_HOURS = 3
ADMIN_TOKEN_LIFETIME_MINUTES = 60

ADMIN_ROOM_LIFETIME_1_HOUR = 1
ADMIN_ROOM_LIFETIME_1_DAY = 24
ADMIN_ROOM_LIFETIME_1_MONTH = 24 * 30  # 720 hours
ADMIN_ROOM_LIFETIME_1_YEAR = 24 * 365 # 8760 hours

# --- НОВЫЕ КОНСТАНТЫ ДЛЯ ЗАЩИТЫ ОТ СПАМА ---
SPAM_STRIKE_LIMIT = 15  # Количество "плохих" действий до блокировки
SPAM_TIME_WINDOW_MINUTES = 30  # Временное окно в минутах для подсчета действий
# --- КОНЕЦ НОВЫХ КОНСТАНТ ---

# --- НОВЫЕ КОНСТАНТЫ ДЛЯ ОГРАНИЧЕНИЯ СОЗДАНИЯ КОМНАТ ---
MAX_ACTIVE_ROOMS_PER_USER = 3  # Макс. кол-во одновременно активных комнат на пользователя
MAX_ROOM_CREATIONS_PER_DAY = 10 # Макс. кол-во создаваемых комнат в сутки на пользователя
# --- КОНЕЦ НОВЫХ КОНСТАНТ ---

if not BOT_TOKEN:
    print("КРИТИЧЕСКАЯ ОШИБКА: Токен бота (BOT_TOKEN) не найден в переменных окружения.", file=sys.stderr)
    sys.exit(1)