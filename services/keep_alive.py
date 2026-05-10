import asyncio
import logging
import os
import random
import time
from typing import Any

import httpx

from config.config_manager import load_advanced_config
from services.stats_manager import init_stat, reset_stats, update_stat
from utils.logger import log

_runtime_state: dict[str, Any] = {
    "reload_event": None,
}


def load_config() -> dict:
    """Обёртка для загрузки конфигурации keep-alive."""
    return load_advanced_config()


async def request_runtime_reload() -> None:
    """Сигнализирует фоновой задаче, что конфигурация обновилась и её нужно перечитать."""
    event = _runtime_state.get("reload_event")
    if event is not None:
        event.set()


async def check_internet_connection(timeout_seconds: int = 10) -> bool:
    """Проверяет базовое подключение к интернету, обращаясь к google.com."""
    try:
        async with httpx.AsyncClient(timeout=float(timeout_seconds)) as client:
            response = await client.get("https://www.google.com")
            response.raise_for_status()
        log("KEEP_ALIVE", "Проверка подключения к интернету пройдена успешно.")
        return True
    except httpx.RequestError as error:
        log(
            "ERROR",
            f"Не удалось подключиться к google.com. Проверьте сетевые настройки. Ошибка: {error}",
            level=logging.ERROR,
        )
        return False


async def monitor_url(url: str, target_id: str, task_name: str, headers: dict, settings: dict):
    """
    Универсальная функция для периодической проверки доступности URL.
    Один HTTP-клиент переиспользуется внутри мониторинга, чтобы не создавать
    заново пул соединений и DNS-состояние на каждом цикле проверки.
    """
    log("KEEP_ALIVE", f"[{task_name}] 🚀 Запущен мониторинг для: {url}")

    init_stat(target_id, task_name, url)

    min_wait = settings.get("min_wait_minutes", 13)
    max_wait = settings.get("max_wait_minutes", 14)
    error_wait = settings.get("error_wait_seconds", 60)
    request_timeout = settings.get("request_timeout_seconds", 30)
    timeout = httpx.Timeout(float(request_timeout))
    limits = httpx.Limits(max_keepalive_connections=5, max_connections=10, keepalive_expiry=30.0)

    async with httpx.AsyncClient(timeout=timeout, limits=limits, headers=headers, follow_redirects=True) as client:
        while True:
            wait_seconds = 0
            is_success = False
            status_code = 0
            start_time = time.monotonic()

            try:
                log("KEEP_ALIVE", f"[{task_name}] 📡 Отправляю запрос на {url}...")
                response = await client.get(url)
                status_code = response.status_code

                if 200 <= response.status_code < 300:
                    log("KEEP_ALIVE", f"[{task_name}] ✅ Сайт АКТИВЕН. Ответ: {response.status_code}.")
                    is_success = True
                else:
                    log("KEEP_ALIVE", f"[{task_name}] ⚠️ Получен странный статус: {response.status_code}.", level=logging.WARNING)
                    is_success = False

            except asyncio.CancelledError:
                log("KEEP_ALIVE", f"[{task_name}] ⛔ Мониторинг остановлен.")
                raise
            except httpx.RequestError as error:
                log("ERROR", f"[{task_name}] ❌ Ошибка сети (сайт недоступен): {error}", level=logging.ERROR)
                is_success = False
            except Exception as error:
                log("CRITICAL", f"[{task_name}] ❌ Критическая ошибка в цикле: {error}", level=logging.CRITICAL)
                is_success = False

            elapsed_time = time.monotonic() - start_time
            update_stat(target_id, is_success, status_code, elapsed_time)

            if is_success:
                wait_seconds = random.randint(min_wait * 60, max_wait * 60)
                minutes, seconds = divmod(wait_seconds, 60)
                log("KEEP_ALIVE", f"[{task_name}] 💤 Ухожу в сон на {minutes} мин {seconds} сек.")
            else:
                wait_seconds = error_wait
                log("KEEP_ALIVE", f"[{task_name}] 🔄 Режим восстановления. Повторная проверка через {wait_seconds} сек.")

            await asyncio.sleep(wait_seconds)


async def _build_monitor_tasks(config: dict, headers: dict) -> tuple[list[asyncio.Task], dict]:
    settings = config.get("settings", {})
    targets = [target for target in config.get("targets", []) if target.get("enabled", True)]

    reset_stats()

    tasks: list[asyncio.Task] = []
    for target in targets:
        target_id = target.get("id")
        name = target.get("name", "UNKNOWN")
        url = target.get("url")
        env_override = target.get("env_override")

        if env_override:
            env_url = os.environ.get(env_override)
            if env_url and "localhost" not in env_url and "0.0.0.0" not in env_url:
                url = env_url
                log("KEEP_ALIVE", f"[{name}] Конфигурация URL взята из переменной {env_override}: {url}")
            else:
                log(
                    "KEEP_ALIVE",
                    f"[{name}] Переменная {env_override} пуста или локальна. Используется запасной URL: {url}",
                    level=logging.WARNING,
                )

        if url:
            task = asyncio.create_task(monitor_url(url, str(target_id), name, headers, settings))
            tasks.append(task)
        else:
            log("ERROR", f"[{name}] Пропущен, так как URL не задан в конфигурации.", level=logging.ERROR)

    return tasks, settings


async def _cancel_tasks(tasks: list[asyncio.Task]) -> None:
    for task in tasks:
        task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def _run_monitor_cycle(config: dict, reload_event: asyncio.Event, headers: dict) -> None:
    tasks, settings = await _build_monitor_tasks(config, headers)

    if not tasks:
        log("KEEP_ALIVE", "Нет валидных URL для мониторинга. Ожидание обновления конфигурации...", level=logging.WARNING)
        await reload_event.wait()
        reload_event.clear()
        return

    reload_wait = asyncio.create_task(reload_event.wait())
    wait_set = set(tasks + [reload_wait])

    try:
        done, _ = await asyncio.wait(wait_set, return_when=asyncio.FIRST_COMPLETED)
        if reload_wait in done:
            log("KEEP_ALIVE", "Получен сигнал на обновление конфигурации. Перезапускаю мониторинг...")
            reload_event.clear()
        else:
            for finished in done:
                if finished is not reload_wait:
                    try:
                        finished.exception()
                    except asyncio.CancelledError:
                        pass
                    except Exception as error:
                        log("ERROR", f"Монитор завершился с ошибкой: {error}", level=logging.ERROR)
            log("KEEP_ALIVE", "Один из мониторинговых процессов завершился. Выполняю мягкий перезапуск...")
            reload_event.clear()
    finally:
        reload_wait.cancel()
        await asyncio.gather(reload_wait, return_exceptions=True)
        await _cancel_tasks(tasks)


async def start_keep_alive_task():
    """
    Основная задача-оркестратор. Загружает конфиг и динамически запускает
    независимые процессы мониторинга для каждого URL.
    """
    config = load_config()
    settings = config.get("settings", {})

    initial_delay = settings.get("initial_delay_seconds", 600)
    log("KEEP_ALIVE", f"Сервис самоподдержки инициализирован, старт через {initial_delay} секунд...")

    await asyncio.sleep(initial_delay)

    if not await check_internet_connection(settings.get("internet_check_timeout_seconds", 10)):
        log("ERROR", "Нет интернета при старте. Воркеры запустятся в режиме восстановления.", level=logging.ERROR)

    bot_username_from_env = os.environ.get("BOT_USERNAME", "Unknown")
    headers = {
        "User-Agent": f"KeepAlive-Bot/{bot_username_from_env}"
    }

    reload_event = asyncio.Event()
    _runtime_state["reload_event"] = reload_event

    while True:
        current_config = load_config()
        await _run_monitor_cycle(current_config, reload_event, headers)