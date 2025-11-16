import asyncio
import random
import os
import httpx
import logging
from configurable_logger import log

# Минимальное и максимальное время ожидания в минутах
MIN_WAIT_MINUTES = 12
MAX_WAIT_MINUTES = 14

# "Железный" запасной URL
FALLBACK_URL = "https://bot-29-nx0w.onrender.com"

async def check_internet_connection():
    """Проверяет базовое подключение к интернету, обращаясь к google.com."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://www.google.com")
            response.raise_for_status()
        log("KEEP_ALIVE", "Проверка подключения к интернету пройдена успешно.")
        return True
    except httpx.RequestError as e:
        log("ERROR", f"Не удалось подключиться к google.com. Проверьте сетевые настройки. Ошибка: {e}", level=logging.ERROR)
        return False

async def start_keep_alive_task():
    """
    Основная задача, которая периодически отправляет запросы на главную страницу
    приложения, чтобы предотвратить его "засыпание" на хостинге.
    """
    log("KEEP_ALIVE", "Задача самоподдержки инициализирована, запуск проверки через 60 секунд...")
    await asyncio.sleep(60)

    # ИЗМЕНЕНИЕ: Считываем переменную окружения напрямую внутри задачи
    app_url_from_env = os.environ.get("WEB_APP_URL")
    bot_username_from_env = os.environ.get("BOT_USERNAME")

    APP_URL = None
    
    # Проверяем, что переменная из окружения корректна
    if app_url_from_env and "localhost" not in app_url_from_env and "0.0.0.0" not in app_url_from_env:
        APP_URL = app_url_from_env
        log("KEEP_ALIVE", f"Используется URL из переменной окружения WEB_APP_URL.")
    else:
        APP_URL = FALLBACK_URL
        log("KEEP_ALIVE", f"WEB_APP_URL не найден или некорректен ('{app_url_from_env}'). Используется запасной URL.", level=logging.WARNING)

    log("KEEP_ALIVE", f"Задача самоподдержки запускается. Целевой URL: {APP_URL}")

    if not await check_internet_connection():
        log("ERROR", "Задача самоподдержки остановлена из-за отсутствия подключения к интернету.", level=logging.ERROR)
        return

    headers = {
        "User-Agent": f"KeepAlive-Bot/{bot_username_from_env or 'Internal'}"
    }

    while True:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                log("KEEP_ALIVE", f"Отправляю запрос на {APP_URL}...")
                response = await client.get(APP_URL, headers=headers)

                if 200 <= response.status_code < 300:
                    log("KEEP_ALIVE", f"Успешный ответ от {APP_URL} (Статус: {response.status_code}). Приложение активно.")
                else:
                    log("KEEP_ALIVE", f"Получен неожиданный статус от {APP_URL}: {response.status_code}", level=logging.WARNING)

        except httpx.RequestError as e:
            log("ERROR", f"Ошибка при отправке запроса на {APP_URL}: {e}", level=logging.ERROR)
        except Exception as e:
            log("CRITICAL", f"Непредвиденная ошибка в задаче самоподдержки: {e}", level=logging.CRITICAL)

        # Рассчитываем случайный интервал для следующего запроса
        wait_seconds = random.randint(MIN_WAIT_MINUTES * 60, MAX_WAIT_MINUTES * 60)
        minutes, seconds = divmod(wait_seconds, 60)
        log("KEEP_ALIVE", f"Следующая проверка через {minutes} мин {seconds} сек.")
        await asyncio.sleep(wait_seconds)