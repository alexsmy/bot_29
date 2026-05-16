from __future__ import annotations

from .base import Agent
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
