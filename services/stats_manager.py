from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Any

# Глобальный словарь для хранения состояния каждого URL.
_stats: dict[str, dict[str, Any]] = {}
_stats_lock = RLock()


def reset_stats() -> None:
    """Очищает всю статистику. Используется при перезагрузке конфигурации."""
    with _stats_lock:
        _stats.clear()


def init_stat(target_id: str, name: str, url: str) -> None:
    """Инициализирует базовую статистику для таргета при запуске."""
    with _stats_lock:
        if target_id not in _stats:
            _stats[target_id] = {
                "id": target_id,
                "name": name,
                "url": url,
                "status": "Ожидание...",
                "status_code": None,
                "response_time_ms": 0,
                "last_checked": None,
                "last_checked_iso": None,
                "success_count": 0,
                "fail_count": 0,
            }
        else:
            _stats[target_id]["name"] = name
            _stats[target_id]["url"] = url


def update_stat(target_id: str, is_success: bool, status_code: int, response_time_sec: float) -> None:
    """Обновляет статистику после каждой проверки."""
    checked_at = datetime.now(timezone.utc)
    with _stats_lock:
        if target_id in _stats:
            _stats[target_id]["status"] = "Онлайн" if is_success else "Оффлайн"
            _stats[target_id]["status_code"] = status_code
            _stats[target_id]["response_time_ms"] = round(response_time_sec * 1000)
            _stats[target_id]["last_checked"] = checked_at.strftime("%Y-%m-%d %H:%M:%S")
            _stats[target_id]["last_checked_iso"] = checked_at.isoformat()

            if is_success:
                _stats[target_id]["success_count"] += 1
            else:
                _stats[target_id]["fail_count"] += 1


def get_all_stats() -> list[dict[str, Any]]:
    """Возвращает снимок всей статистики для API без передачи изменяемых ссылок."""
    with _stats_lock:
        return [dict(stat) for stat in _stats.values()]
