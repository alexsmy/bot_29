import os
import asyncio
import uvicorn
from fastapi import FastAPI
from services.keep_alive import start_keep_alive_task
from utils.logger import log

# Микро-приложение FastAPI необходимо для того, чтобы Render 
# успешно привязал сервис к порту и не убил процесс.
app = FastAPI()

@app.get("/")
async def health_check():
    return {"status": "Keep-Alive Microservice is running"}

async def main():
    log("APP_LIFECYCLE", "Запуск изолированного сервиса автоподдержки (Keep-Alive)...")
    
    # 1. Запускаем твою оригинальную задачу keep_alive в фоне
    keep_alive_task = asyncio.create_task(start_keep_alive_task())
    
    # 2. Запускаем минимальный веб-сервер для удовлетворения требований Render
    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_config=None)
    server = uvicorn.Server(config)
    
    server_task = asyncio.create_task(server.serve())
    
    # Ожидаем выполнения обеих задач
    await asyncio.gather(server_task, keep_alive_task)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log("APP_LIFECYCLE", "Сервис автоподдержки остановлен.")