import asyncio
import random
import os
import httpx
from logger_config import logger

# Минимальное и максимальное время ожидания в минутах
MIN_WAIT_MINUTES = 12
MAX_WAIT_MINUTES = 14

# "Железный" запасной URL, как вы и просили
FALLBACK_URL = "https://bot-29-nx0w.onrender.com"

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
    logger.info("[KeepAlive] Задача самоподдержки инициализирована, запуск проверки через 60 секунд...")
    await asyncio.sleep(60)

    # ИЗМЕНЕНИЕ: Считываем переменную окружения напрямую внутри задачи
    app_url_from_env = os.environ.get("WEB_APP_URL")
    bot_username_from_env = os.environ.get("BOT_USERNAME")

    APP_URL = None
    
    # Проверяем, что переменная из окружения корректна
    if app_url_from_env and "localhost" not in app_url_from_env and "0.0.0.0" not in app_url_from_env:
        APP_URL = app_url_from_env
        logger.info(f"[KeepAlive] Используется URL из переменной окружения WEB_APP_URL.")
    else:
        APP_URL = FALLBACK_URL
        logger.warning(f"[KeepAlive] WEB_APP_URL не найден или некорректен ('{app_url_from_env}'). Используется запасной URL.")

    logger.info(f"[KeepAlive] Задача самоподдержки запускается. Целевой URL: {APP_URL}")

    if not await check_internet_connection():
        logger.error("[KeepAlive] Задача самоподдержки остановлена из-за отсутствия подключения к интернету.")
        return

    headers = {
        "User-Agent": f"KeepAlive-Bot/{bot_username_from_env or 'Internal'}"
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