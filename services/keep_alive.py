import asyncio
import random
import os
import httpx
import logging
import time

from utils.logger import log
from config.config_manager import load_advanced_config
from services.stats_manager import init_stat, update_stat

def load_config() -> dict:
    """
    Обертка для загрузки конфигурации.
    Теперь использует новый менеджер конфигураций, не меняя логику вызовов ниже.
    """
    return load_advanced_config()

async def check_internet_connection() -> bool:
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

async def monitor_url(url: str, task_name: str, headers: dict, settings: dict):
    """
    Универсальная функция для периодической проверки доступности URL.
    """
    log("KEEP_ALIVE", f"[{task_name}] 🚀 Запущен мониторинг для: {url}")
    
    # Инициализируем статистику для веб-интерфейса
    init_stat(task_name, url)

    min_wait = settings.get("min_wait_minutes", 13)
    max_wait = settings.get("max_wait_minutes", 14)
    error_wait = settings.get("error_wait_seconds", 60)

    while True:
        wait_seconds = 0
        is_success = False
        status_code = 0
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                log("KEEP_ALIVE", f"[{task_name}] 📡 Отправляю запрос на {url}...")
                response = await client.get(url, headers=headers)
                status_code = response.status_code

                if 200 <= response.status_code < 300:
                    log("KEEP_ALIVE", f"[{task_name}] ✅ Сайт АКТИВЕН. Ответ: {response.status_code}.")
                    is_success = True
                else:
                    log("KEEP_ALIVE", f"[{task_name}] ⚠️ Получен странный статус: {response.status_code}.", level=logging.WARNING)
                    is_success = False

        except httpx.RequestError as e:
            log("ERROR", f"[{task_name}] ❌ Ошибка сети (сайт недоступен): {e}", level=logging.ERROR)
            is_success = False
        except Exception as e:
            log("CRITICAL", f"[{task_name}] ❌ Критическая ошибка в цикле: {e}", level=logging.CRITICAL)
            is_success = False

        # Вычисляем время отклика и обновляем статистику
        elapsed_time = time.time() - start_time
        update_stat(task_name, is_success, status_code, elapsed_time)

        if is_success:
            wait_seconds = random.randint(min_wait * 60, max_wait * 60)
            minutes, seconds = divmod(wait_seconds, 60)
            log("KEEP_ALIVE", f"[{task_name}] 💤 Ухожу в сон на {minutes} мин {seconds} сек.")
        else:
            wait_seconds = error_wait
            log("KEEP_ALIVE", f"[{task_name}] 🔄 Режим восстановления. Повторная проверка через {wait_seconds} сек.")

        await asyncio.sleep(wait_seconds)

async def start_keep_alive_task():
    """
    Основная задача-оркестратор. Загружает конфиг и динамически запускает
    независимые процессы мониторинга для каждого URL.
    """
    config = load_config()
    settings = config.get("settings", {})
    targets = config.get("targets",[])

    initial_delay = settings.get("initial_delay_seconds", 600)
    log("KEEP_ALIVE", f"Сервис самоподдержки инициализирован, старт через {initial_delay} секунд...")

    await asyncio.sleep(initial_delay)

    if not await check_internet_connection():
        log("ERROR", "Нет интернета при старте. Воркеры запустятся в режиме восстановления.", level=logging.ERROR)

    bot_username_from_env = os.environ.get("BOT_USERNAME", "Unknown")
    headers = {
        "User-Agent": f"KeepAlive-Bot/{bot_username_from_env}"
    }

    tasks =[]
    for target in targets:
        name = target.get("name", "UNKNOWN")
        url = target.get("url")
        env_override = target.get("env_override")

        if env_override:
            env_url = os.environ.get(env_override)
            if env_url and "localhost" not in env_url and "0.0.0.0" not in env_url:
                url = env_url
                log("KEEP_ALIVE", f"[{name}] Конфигурация URL взята из переменной {env_override}: {url}")
            else:
                log("KEEP_ALIVE", f"[{name}] Переменная {env_override} пуста или локальна. Используется запасной URL: {url}", level=logging.WARNING)

        if url:
            task = asyncio.create_task(monitor_url(url, name, headers, settings))
            tasks.append(task)
        else:
            log("ERROR", f"[{name}] Пропущен, так как URL не задан в конфигурации.", level=logging.ERROR)

    if tasks:
        await asyncio.gather(*tasks)
    else:
        log("KEEP_ALIVE", "Нет валидных URL для мониторинга. Сервис остановлен.", level=logging.WARNING)