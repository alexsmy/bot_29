import os
import asyncio
import contextlib

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from routers.keepalive_api import router as keepalive_router
from routers.crpt_api import router as crpt_router
from routers.filevault_api import router as filevault_router, public_router as filevault_public_router
from routers.web import router as web_router
from routers.telegram_tunnel_api import router as telegram_tunnel_router
from routers.telegram_inbox_api import router as telegram_inbox_router
from routers.agents_api import router as agents_router
from services.agents.mcp_server import mcp as weather_mcp
from services.keep_alive import start_keep_alive_task
from services.telegram_listener import listener_loop
from services.telegram_hub.bot_runner import run_telegram_bot
from utils.logger import log


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    log("APP_LIFECYCLE", "MCP session manager запущен")
    listener_task = asyncio.create_task(listener_loop())
    async with weather_mcp.session_manager.run():
        yield
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass
    log("APP_LIFECYCLE", "MCP session manager остановлен")


app = FastAPI(lifespan=lifespan)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

os.makedirs("project", exist_ok=True)
app.mount("/project", StaticFiles(directory="project"), name="project")

app.include_router(web_router)
app.include_router(keepalive_router)
app.include_router(crpt_router)
app.include_router(filevault_router)
app.include_router(filevault_public_router)
app.include_router(telegram_tunnel_router)
app.include_router(telegram_inbox_router)
app.include_router(agents_router)
app.mount("/mcp", weather_mcp.streamable_http_app())


async def main():
    log("APP_LIFECYCLE", "Запуск изолированного сервиса автоподдержки (Keep-Alive)...")

    keep_alive_task = asyncio.create_task(start_keep_alive_task())
    telegram_hub_task = asyncio.create_task(run_telegram_bot())

    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_config=None)
    server = uvicorn.Server(config)

    server_task = asyncio.create_task(server.serve())

    await asyncio.gather(server_task, keep_alive_task, telegram_hub_task)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log("APP_LIFECYCLE", "Сервис автоподдержки остановлен.")
