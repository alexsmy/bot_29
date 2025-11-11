# core.py

import json
from datetime import datetime, date
from typing import Any
from fastapi.responses import Response
from fastapi.templating import Jinja2Templates

class CustomJSONResponse(Response):
    """
    Кастомный JSON-ответ для корректной сериализации datetime объектов.
    """
    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            default=lambda o: o.isoformat() if isinstance(o, (datetime, date)) else None,
        ).encode("utf-8")

# Создаем экземпляр Jinja2Templates, который будет использоваться во всем приложении
templates = Jinja2Templates(directory="templates")