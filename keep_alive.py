import asyncio
import random
import os
import json
import httpx
import logging
from configurable_logger import log

CONFIG_FILE = "keep_alive_urls.json"

def load_config() -> dict:
    """
    Загружает конфигурацию URL-адресов и таймингов из JSON файла.
    Если файл отсутствует, создает его с настройками по умолчанию.
    """
    default_config = {
        "settings": {
            "min_wait_minutes": 13,
            "max_wait_minutes": 14,
            "error_wait_seconds": 60,
            "initial_delay_seconds": 600
        },
        "targets":[
            {
                "name": "PRIMARY",
                "url": "https://bot-29-nx0w.onrender.com",
                "env_override": "WEB_APP_URL"
            },
            {
                "name": "SECONDARY",
                "url": "https://ai-web-1z20.onrender.com",
                "env_override": None
            },
            {
                "name": "T3",
                "url": "https://wbtg-001.onrender.com/ping",
                "env_override": None
            }
        ]
    }

    if not os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=4, ensure_ascii=False)
            log("KEEP_ALIVE", f"Создан файл конфигурации по умолчанию: {CONFIG_FILE}")
        except Exception as e:
            log("ERROR", f"Не удалось создать {CONFIG_FILE}: {e}", level=logging.ERROR)
        return default_config

    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        log("ERROR", f"Ошибка чтения {CONFIG_FILE}, используются настройки по умолчанию. Ошибка: {e}", level=logging.ERROR)
        return default_config

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
    
    :param url: Адрес для проверки.
    :param task_name: Имя задачи для логов (например, "PRIMARY" или "SECONDARY").
    :param headers: Заголовки запроса.
    :param settings: Словарь с настройками таймингов.
    """
    log("KEEP_ALIVE", f"[{task_name}] 🚀 Запущен мониторинг для: {url}")

    min_wait = settings.get("min_wait_minutes", 13)
    max_wait = settings.get("max_wait_minutes", 14)
    error_wait = settings.get("error_wait_seconds", 60)

    while True:
        wait_seconds = 0
        is_success = False

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                log("KEEP_ALIVE", f"[{task_name}] 📡 Отправляю запрос на {url}...")
                response = await client.get(url, headers=headers)

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

        # Логика определения времени ожидания и информирование
        if is_success:
            # Если успех - ждем случайное время в заданном диапазоне
            wait_seconds = random.randint(min_wait * 60, max_wait * 60)
            minutes, seconds = divmod(wait_seconds, 60)
            log("KEEP_ALIVE", f"[{task_name}] 💤 Ухожу в сон на {minutes} мин {seconds} сек.")
        else:
            # Если ошибка - ждем фиксированное время (режим восстановления)
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
    
    # Первичная задержка перед стартом всего сервиса
    await asyncio.sleep(initial_delay)

    # Проверка интернета перед запуском воркеров
    if not await check_internet_connection():
        log("ERROR", "Нет интернета при старте. Воркеры запустятся в режиме восстановления.", level=logging.ERROR)

    bot_username_from_env = os.environ.get("BOT_USERNAME", "Unknown")
    headers = {
        "User-Agent": f"KeepAlive-Bot/{bot_username_from_env}"
    }

    # Динамическое создание задач на основе конфигурации
    tasks =[]
    for target in targets:
        name = target.get("name", "UNKNOWN")
        url = target.get("url")
        env_override = target.get("env_override")

        # Проверяем, нужно ли переопределить URL из переменных окружения
        if env_override:
            env_url = os.environ.get(env_override)
            if env_url and "localhost" not in env_url and "0.0.0.0" not in env_url:
                url = env_url
                log("KEEP_ALIVE", f"[{name}] Конфигурация URL взята из переменной {env_override}: {url}")
            else:
                log("KEEP_ALIVE", f"[{name}] Переменная {env_override} пуста или локальна. Используется запасной URL: {url}", level=logging.WARNING)

        if url:
            # Создаем независимую задачу для каждого валидного URL
            task = asyncio.create_task(monitor_url(url, name, headers, settings))
            tasks.append(task)
        else:
            log("ERROR", f"[{name}] Пропущен, так как URL не задан в конфигурации.", level=logging.ERROR)

    # Ожидаем выполнения всех созданных задач
    if tasks:
        await asyncio.gather(*tasks)
    else:
        log("KEEP_ALIVE", "Нет валидных URL для мониторинга. Сервис остановлен.", level=logging.WARNING)