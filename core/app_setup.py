# core/app_setup.py

import json
import os
from datetime import datetime, date
from typing import Any
from fastapi.responses import Response
from fastapi.templating import Jinja2Templates

LOGS_DIR = "connection_logs"

class CustomJSONResponse(Response):
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

templates = Jinja2Templates(directory="templates")