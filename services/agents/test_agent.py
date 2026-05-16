from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .base import AgentCommand


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TestEchoAgent:
    name = "test_echo"

    async def run(self, command: AgentCommand) -> dict[str, Any]:
        query = command.query.strip()
        words = [part for part in query.split() if part]
        return {
            "ok": True,
            "agent": self.name,
            "request_id": command.request_id,
            "received_at": command.received_at,
            "completed_at": _utc_now_iso(),
            "query": query,
            "summary": {
                "characters": len(query),
                "words": len(words),
                "has_question_mark": "?" in query,
            },
            "echo": query,
            "note": "Это тестовый агент. Он не выполняет внешние действия, а только формирует JSON-ответ.",
        }
