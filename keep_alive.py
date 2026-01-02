import asyncio
import random
import os
import httpx
import logging
from configurable_logger import log

# --- КОНФИГУРАЦИЯ ---

# Минимальное и максимальное время ожидания в минутах (для успешных запросов)
MIN_WAIT_MINUTES = 13
MAX_WAIT_MINUTES = 14

# Время ожидания при ошибке (в секундах)
ERROR_WAIT_SECONDS = 60

# "Железный" запасной URL для основного приложения
FALLBACK_PRIMARY_URL = "https://bot-29-nx0w.onrender.com"

# ВТОРОЙ НЕЗАВИСИМЫЙ АДРЕС (вводится напрямую в код)
# Замените на нужный вам URL
SECONDARY_URL = "https://ai-web-1z20.onrender.com" 

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

async def monitor_url(url: str, task_name: str, headers: dict):
    """
    Универсальная функция для периодической проверки доступности URL.
    
    :param url: Адрес для проверки.
    :param task_name: Имя задачи для логов (например, "Primary" или "Secondary").
    :param headers: Заголовки запроса.
    """
    log("KEEP_ALIVE", f"[{task_name}] Запущен мониторинг для: {url}")

    while True:
        wait_seconds = 0
        is_success = False

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                log("KEEP_ALIVE", f"[{task_name}] Отправляю запрос на {url}...")
                response = await client.get(url, headers=headers)

                if 200 <= response.status_code < 300:
                    log("KEEP_ALIVE", f"[{task_name}] Успех! {url} (Статус: {response.status_code}).")
                    is_success = True
                else:
                    log("KEEP_ALIVE", f"[{task_name}] Неожиданный статус от {url}: {response.status_code}", level=logging.WARNING)
                    is_success = False

        except httpx.RequestError as e:
            log("ERROR", f"[{task_name}] Ошибка сети при запросе к {url}: {e}", level=logging.ERROR)
            is_success = False
        except Exception as e:
            log("CRITICAL", f"[{task_name}] Критическая ошибка: {e}", level=logging.CRITICAL)
            is_success = False

        # Логика определения времени ожидания
        if is_success:
            # Если успех - ждем от 13 до 14 минут
            wait_seconds = random.randint(MIN_WAIT_MINUTES * 60, MAX_WAIT_MINUTES * 60)
            minutes, seconds = divmod(wait_seconds, 60)
            log("KEEP_ALIVE", f"[{task_name}] Следующая проверка через {minutes} мин {seconds} сек.")
        else:
            # Если ошибка - ждем 60 секунд (режим восстановления)
            wait_seconds = ERROR_WAIT_SECONDS
            log("KEEP_ALIVE", f"[{task_name}] Повторная попытка через {wait_seconds} сек из-за ошибки.")

        await asyncio.sleep(wait_seconds)

async def start_keep_alive_task():
    """
    Основная задача-оркестратор. Инициализирует переменные и запускает
    независимые процессы мониторинга.
    """
    log("KEEP_ALIVE", "Сервис самоподдержки инициализирован, старт через 600 секунд...")
    
    # Первичная задержка перед стартом всего сервиса
    await asyncio.sleep(600)

    # 1. Настройка основного URL
    app_url_from_env = os.environ.get("WEB_APP_URL")
    bot_username_from_env = os.environ.get("BOT_USERNAME")
    
    primary_url = None
    
    if app_url_from_env and "localhost" not in app_url_from_env and "0.0.0.0" not in app_url_from_env:
        primary_url = app_url_from_env
        log("KEEP_ALIVE", f"Используется URL из ENV: {primary_url}")
    else:
        primary_url = FALLBACK_PRIMARY_URL
        log("KEEP_ALIVE", f"WEB_APP_URL не найден/некорректен. Используется запасной: {primary_url}", level=logging.WARNING)

    # 2. Проверка интернета перед запуском воркеров
    if not await check_internet_connection():
        log("ERROR", "Нет интернета. Задача самоподдержки переходит в режим ожидания восстановления внутри воркеров.", level=logging.ERROR)
        # Мы не делаем return, так как воркеры сами умеют ждать появления сети (через retry logic)

    headers = {
        "User-Agent": f"KeepAlive-Bot/{bot_username_from_env or 'Internal'}"
    }

    # 3. Запуск независимых задач
    # Создаем две задачи, которые будут работать параллельно
    task1 = asyncio.create_task(monitor_url(primary_url, "PRIMARY", headers))
    task2 = asyncio.create_task(monitor_url(SECONDARY_URL, "SECONDARY", headers))

    # Ожидаем выполнения обеих задач (они бесконечны, поэтому await будет висеть вечно, поддерживая работу)
    await asyncio.gather(task1, task2)