import asyncio
import random
import httpx
from logger_config import logger
from config import BOT_USERNAME, WEB_APP_URL

# ИЗМЕНЕНИЕ: Теперь мы напрямую используем WEB_APP_URL, импортированный из config.py
APP_URL = WEB_APP_URL
if not APP_URL or APP_URL.startswith("http://localhost"):
    logger.warning("[KeepAlive] Внешний URL (WEB_APP_URL) не настроен. Задача самоподдержки не будет запущена.")
    APP_URL = None

# Минимальное и максимальное время ожидания в минутах
MIN_WAIT_MINUTES = 11
MAX_WAIT_MINUTES = 14

async def check_internet_connection():
    """Проверяет базовое подключение к интернету, обращаясь к google.com."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://www.google.com")
            response.raise_for_status()
        logger.info("[KeepAlive] Проверка подключения к интернету пройдена успешно.")
        return True
    except httpx.RequestError as e:
        logger.error(f"[KeepAlive] Не удалось подключиться к google.com. Проверьте сетевые настройки. Ошибка: {e}")
        return False

async def start_keep_alive_task():
    """
    Основная задача, которая периодически отправляет запросы на главную страницу
    приложения, чтобы предотвратить его "засыпание" на хостинге.
    """
    if not APP_URL:
        return

    logger.info(f"[KeepAlive] Задача самоподдержки запускается. Целевой URL: {APP_URL}")

    # Начальная задержка в 60 секунд, чтобы дать основному приложению полностью запуститься
    await asyncio.sleep(60)

    if not await check_internet_connection():
        logger.error("[KeepAlive] Задача самоподдержки остановлена из-за отсутствия подключения к интернету.")
        return

    headers = {
        "User-Agent": f"KeepAlive-Bot/{BOT_USERNAME or 'Internal'}"
    }

    while True:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                logger.info(f"[KeepAlive] Отправляю запрос на {APP_URL}...")
                response = await client.get(APP_URL, headers=headers)

                if 200 <= response.status_code < 300:
                    logger.info(f"[KeepAlive] Успешный ответ от {APP_URL} (Статус: {response.status_code}). Приложение активно.")
                else:
                    logger.warning(f"[KeepAlive] Получен неожиданный статус от {APP_URL}: {response.status_code}")

        except httpx.RequestError as e:
            logger.error(f"[KeepAlive] Ошибка при отправке запроса на {APP_URL}: {e}")
        except Exception as e:
            logger.critical(f"[KeepAlive] Непредвиденная ошибка в задаче самоподдержки: {e}")

        # Рассчитываем случайный интервал для следующего запроса
        wait_seconds = random.randint(MIN_WAIT_MINUTES * 60, MAX_WAIT_MINUTES * 60)
        minutes, seconds = divmod(wait_seconds, 60)
        logger.info(f"[KeepAlive] Следующая проверка через {minutes} мин {seconds} сек.")
        await asyncio.sleep(wait_seconds)