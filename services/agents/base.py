from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(slots=True)
class AgentCommand:
    agent: str
    query: str
    request_id: str
    raw: dict[str, Any]
    received_at: str


@dataclass(slots=True)
class AgentExecutionResult:
    agent: str
    request_id: str
    query: str
    output: dict[str, Any]
    response_filename: str
    response_file_id: str | None = None
    response_disk_path: str | None = None
    job_disk_path: str | None = None


class Agent(Protocol):
    name: str

    async def run(self, command: AgentCommand) -> dict[str, Any]:
        ...
