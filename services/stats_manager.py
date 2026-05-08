from datetime import datetime
from typing import Any

# Глобальный словарь для хранения состояния каждого URL.
_stats: dict[str, dict[str, Any]] = {}


def reset_stats() -> None:
    """Очищает всю статистику. Используется при перезагрузке конфигурации."""
    _stats.clear()


def init_stat(target_id: str, name: str, url: str):
    """Инициализирует базовую статистику для таргета при запуске."""
    if target_id not in _stats:
        _stats[target_id] = {
            "id": target_id,
            "name": name,
            "url": url,
            "status": "Ожидание...",
            "status_code": None,
            "response_time_ms": 0,
            "last_checked": None,
            "success_count": 0,
            "fail_count": 0,
        }
    else:
        _stats[target_id]["name"] = name
        _stats[target_id]["url"] = url


def update_stat(target_id: str, is_success: bool, status_code: int, response_time_sec: float):
    """Обновляет статистику после каждой проверки."""
    if target_id in _stats:
        _stats[target_id]["status"] = "Онлайн" if is_success else "Оффлайн"
        _stats[target_id]["status_code"] = status_code
        _stats[target_id]["response_time_ms"] = round(response_time_sec * 1000)
        _stats[target_id]["last_checked"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if is_success:
            _stats[target_id]["success_count"] += 1
        else:
            _stats[target_id]["fail_count"] += 1


def get_all_stats() -> list:
    """Возвращает список всей статистики для API."""
    return list(_stats.values())