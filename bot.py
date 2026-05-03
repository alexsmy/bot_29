import os
import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from services.keep_alive import start_keep_alive_task
from utils.logger import log
from routers.web import router as web_router

app = FastAPI()

# Создаем папку static, если ее нет, и монтируем для раздачи статики (CSS/JS)
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(web_router)

async def main():
    log("APP_LIFECYCLE", "Запуск изолированного сервиса автоподдержки (Keep-Alive)...")

    keep_alive_task = asyncio.create_task(start_keep_alive_task())

    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_config=None)
    server = uvicorn.Server(config)

    server_task = asyncio.create_task(server.serve())

    await asyncio.gather(server_task, keep_alive_task)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log("APP_LIFECYCLE", "Сервис автоподдержки остановлен.")