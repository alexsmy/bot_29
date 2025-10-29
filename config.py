import os
import sys

# --- Environment Variables ---
# Bot Configuration
BOT_TOKEN = os.environ.get("BOT_TOKEN")
BOT_NAME = os.environ.get("BOT_NAME", "Telegram Caller")
BOT_USERNAME = os.environ.get("BOT_USERNAME", "")
ADMIN_USER_ID = os.environ.get("ADMIN_USER_ID")

# Web Application Configuration
WEB_APP_URL = os.environ.get("WEB_APP_URL", "http://localhost:8000")
if not WEB_APP_URL.endswith('/'):
    WEB_APP_URL += '/'

# Database Configuration
DATABASE_NAME = "telecaller.db"

# ICE/TURN Provider Credentials
ICE_SERVERS_CONFIG_FILE = "ice_servers.json"
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
XIRSYS_IDENT = os.environ.get("XIRSYS_IDENT")
XIRSYS_SECRET = os.environ.get("XIRSYS_SECRET")
COTURN_HOST = os.environ.get("COTURN_HOST")
COTURN_USER = os.environ.get("COTURN_USER")
COTURN_SECRET = os.environ.get("COTURN_SECRET")


# --- Application Constants ---
PRIVATE_ROOM_LIFETIME_HOURS = 3
ADMIN_TOKEN_LIFETIME_MINUTES = 60


# --- Critical Checks ---
# Проверяем наличие критически важного токена при запуске
if not BOT_TOKEN:
    print("КРИТИЧЕСКАЯ ОШИБКА: Токен бота (BOT_TOKEN) не найден в переменных окружения.", file=sys.stderr)
    sys.exit(1)