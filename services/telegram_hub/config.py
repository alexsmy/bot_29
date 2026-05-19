import os

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_PIN = os.getenv("TELEGRAM_ADMIN_PIN", "1234")

BASE_DIR = "project"
FILEVAULT_DIR = os.path.join(BASE_DIR, "filevault_storage")
