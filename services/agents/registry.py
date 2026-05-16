from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

from .base import Agent, AgentCommand
from .test_agent import TestEchoAgent
from .weather_monitor import WeatherMonitorAgent
from .weather_notifier import WeatherNotifierAgent

TEST_ECHO_AGENT = TestEchoAgent()
WEATHER_MONITOR_AGENT = WeatherMonitorAgent()
WEATHER_NOTIFIER_AGENT = WeatherNotifierAgent()

AGENT_REGISTRY: dict[str, Agent] = {
    TEST_ECHO_AGENT.name: TEST_ECHO_AGENT,
    "test": TEST_ECHO_AGENT,
    "echo": TEST_ECHO_AGENT,
    WEATHER_MONITOR_AGENT.name: WEATHER_MONITOR_AGENT,
    "weather": WEATHER_MONITOR_AGENT,
    WEATHER_NOTIFIER_AGENT.name: WEATHER_NOTIFIER_AGENT,
    "weather_tg": WEATHER_NOTIFIER_AGENT,
}

DYNAMIC_AGENTS_DIR = Path("data/agents/dynamic")

_BUILTIN_NAMES: set[str] = {
    "test_echo", "test", "echo",
    "weather_monitor", "weather",
    "weather_notifier", "weather_tg",
}


class _DynamicAgentAdapter:
    """Wraps a module with NAME + run(query, args) into Agent protocol."""

    def __init__(self, name: str, run_func: Any) -> None:
        self.name = name
        self._run_func = run_func

    async def run(self, command: AgentCommand) -> dict[str, Any]:
        return await self._run_func(command.query, command.args)


def _find_agent_in_module(module: Any) -> Agent | None:
    """Extract Agent from a dynamically loaded module.
    Supports two formats:
      1. Module-level 'agent' variable with .name and .run(command)
      2. NAME (str) + async run(query, args) -> dict
    """
    agent = getattr(module, "agent", None)
    if agent is not None and hasattr(agent, "name") and hasattr(agent, "run"):
        return agent

    name = getattr(module, "NAME", None)
    run_func = getattr(module, "run", None)
    if name and run_func and callable(run_func):
        return _DynamicAgentAdapter(str(name).strip(), run_func)

    return None


def _load_dynamic_agents() -> None:
    """Scan DYNAMIC_AGENTS_DIR and register all valid agents."""
    DYNAMIC_AGENTS_DIR.mkdir(parents=True, exist_ok=True)
    for py_file in sorted(DYNAMIC_AGENTS_DIR.glob("*.py")):
        if py_file.stem == "__init__":
            continue
        import_and_register_dynamic_agent(py_file)


def import_and_register_dynamic_agent(py_file: Path) -> bool:
    """Import a single .py file and register the agent inside it."""
    module_name = f"_dynamic_agent_{py_file.stem}"
    try:
        spec = importlib.util.spec_from_file_location(module_name, py_file)
        if not spec or not spec.loader:
            return False
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        agent = _find_agent_in_module(module)
        if agent is None:
            return False
        register_dynamic_agent(agent, py_file.stem if py_file.stem != agent.name else None)
        return True
    except Exception:
        return False


def register_dynamic_agent(agent: Agent, alias: str | None = None) -> None:
    """Register a dynamically loaded agent in the registry."""
    AGENT_REGISTRY[agent.name] = agent
    if alias and alias != agent.name:
        AGENT_REGISTRY[alias] = agent


def unregister_dynamic_agent(name: str) -> bool:
    """Remove a dynamic agent from the registry by name or alias."""
    normalized = normalize_agent_name(name)
    instance = AGENT_REGISTRY.get(normalized)
    if instance is None:
        return False
    if normalized in _BUILTIN_NAMES:
        return False
    keys = [k for k, v in AGENT_REGISTRY.items() if v is instance]
    for k in keys:
        del AGENT_REGISTRY[k]
    return True


def is_builtin(name: str) -> bool:
    """Check if an agent name refers to a built-in agent."""
    normalized = normalize_agent_name(name)
    return normalized in _BUILTIN_NAMES


# Load dynamic agents that were uploaded in previous sessions
_load_dynamic_agents()


def normalize_agent_name(raw_name: str | None) -> str:
    value = (raw_name or "test_echo").strip().lower().replace("-", "_")
    if not value:
        return "test_echo"
    return value


def get_agent(name: str | None) -> Agent:
    normalized = normalize_agent_name(name)
    agent = AGENT_REGISTRY.get(normalized)
    if agent is None:
        raise KeyError(f"Unknown agent: {name}")
    return agent


def list_agents() -> list[str]:
    return list(dict.fromkeys(AGENT_REGISTRY.keys()))


def has_agent(name: str | None) -> bool:
    try:
        get_agent(name)
        return True
    except KeyError:
        return False
