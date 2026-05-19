from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from config.config_manager import load_advanced_config, save_advanced_config
from config.keepalive_security import verify_pin
from services.stats_manager import get_all_stats


@dataclass(slots=True)
class SupportSnapshot:
    config: dict[str, Any]
    stats: list[dict[str, Any]]
    total: int
    online: int
    offline: int
    checks: int


_SETTINGS_ACCESS_TTL = 30 * 60
_settings_access: dict[int, float] = {}


def _now() -> float:
    return time.time()


def unlock_settings(chat_id: int) -> None:
    _settings_access[int(chat_id)] = _now() + _SETTINGS_ACCESS_TTL


def lock_settings(chat_id: int) -> None:
    _settings_access.pop(int(chat_id), None)


def settings_unlocked(chat_id: int) -> bool:
    expires = _settings_access.get(int(chat_id), 0.0)
    if expires <= _now():
        _settings_access.pop(int(chat_id), None)
        return False
    return True


def check_pin(pin: str) -> bool:
    config = load_advanced_config(public=False, strict_integrity=True)
    security = config.get("security", {})
    return verify_pin(pin, security)


def get_snapshot() -> SupportSnapshot:
    config = load_advanced_config(public=True, strict_integrity=True)
    stats = get_all_stats()
    target_map = {str(item.get("id", "")): item for item in stats}

    total = len(config.get("targets", []))
    online = 0
    offline = 0
    checks = 0
    for target in config.get("targets", []):
        stat = target_map.get(str(target.get("id", "")), {})
        status = str(stat.get("status", "")).lower()
        if status == "онлайн":
            online += 1
        elif status == "оффлайн":
            offline += 1
        checks += int(stat.get("success_count", 0) or 0) + int(stat.get("fail_count", 0) or 0)

    return SupportSnapshot(
        config=config,
        stats=stats,
        total=total,
        online=online,
        offline=offline,
        checks=checks,
    )


def get_target_stats(target_id: str) -> dict[str, Any]:
    for stat in get_all_stats():
        if str(stat.get("id")) == str(target_id):
            return stat
    return {}


def update_target(target_id: str, *, enabled: bool | None = None, url: str | None = None, name: str | None = None) -> dict[str, Any]:
    config = load_advanced_config(public=False, strict_integrity=True)
    targets = list(config.get("targets", []))
    found = False

    for target in targets:
        if str(target.get("id")) != str(target_id):
            continue
        if enabled is not None:
            target["enabled"] = bool(enabled)
        if url is not None:
            target["url"] = str(url).strip()
        if name is not None:
            target["name"] = str(name).strip()
        found = True
        break

    if not found:
        raise ValueError("Target not found")

    config["targets"] = targets
    return save_advanced_config(config)


def delete_target(target_id: str) -> dict[str, Any]:
    config = load_advanced_config(public=False, strict_integrity=True)
    targets = [target for target in config.get("targets", []) if str(target.get("id")) != str(target_id)]
    if len(targets) == len(config.get("targets", [])):
        raise ValueError("Target not found")
    config["targets"] = targets
    return save_advanced_config(config)


def add_target(name: str, url: str) -> dict[str, Any]:
    config = load_advanced_config(public=False, strict_integrity=True)
    targets = list(config.get("targets", []))
    next_id = f"tg_{len(targets) + 1:03d}"
    existing_ids = {str(item.get("id")) for item in targets}
    while next_id in existing_ids:
        next_num = len(existing_ids) + 1
        next_id = f"tg_{next_num:03d}"

    targets.append(
        {
            "id": next_id,
            "name": name.strip(),
            "url": url.strip(),
            "enabled": True,
        }
    )
    config["targets"] = targets
    return save_advanced_config(config)


def update_global_interval(min_wait: int, max_wait: int) -> dict[str, Any]:
    config = load_advanced_config(public=False, strict_integrity=True)
    config.setdefault("settings", {})
    config["settings"]["min_wait_minutes"] = int(min_wait)
    config["settings"]["max_wait_minutes"] = int(max_wait)
    return save_advanced_config(config)
