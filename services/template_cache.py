from __future__ import annotations

from pathlib import Path
from threading import RLock

_template_cache: dict[Path, tuple[float, str]] = {}
_template_cache_lock = RLock()


def read_template(path: str | Path) -> str:
    """Читает HTML-шаблон с лёгким mtime-кэшем, чтобы не трогать диск на каждый запрос."""
    template_path = Path(path)
    mtime = template_path.stat().st_mtime

    with _template_cache_lock:
        cached = _template_cache.get(template_path)
        if cached and cached[0] == mtime:
            return cached[1]

        content = template_path.read_text(encoding="utf-8")
        _template_cache[template_path] = (mtime, content)
        return content
