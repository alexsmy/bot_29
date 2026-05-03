from datetime import datetime

# Глобальный словарь для хранения состояния каждого URL
_stats = {}

def init_stat(name: str, url: str):
    """Инициализирует базовую статистику для таргета при запуске."""
    if name not in _stats:
        _stats[name] = {
            "name": name,
            "url": url,
            "status": "Ожидание...",
            "status_code": None,
            "response_time_ms": 0,
            "last_checked": None,
            "success_count": 0,
            "fail_count": 0
        }

def update_stat(name: str, is_success: bool, status_code: int, response_time_sec: float):
    """Обновляет статистику после каждой проверки."""
    if name in _stats:
        _stats[name]["status"] = "Онлайн" if is_success else "Оффлайн"
        _stats[name]["status_code"] = status_code
        _stats[name]["response_time_ms"] = round(response_time_sec * 1000)
        _stats[name]["last_checked"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        if is_success:
            _stats[name]["success_count"] += 1
        else:
            _stats[name]["fail_count"] += 1

def get_all_stats() -> list:
    """Возвращает список всей статистики для API."""
    return list(_stats.values())