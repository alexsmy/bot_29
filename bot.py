import os
import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from services.keep_alive import start_keep_alive_task
from utils.logger import log
from routers.web import router as web_router
from routers.crpt_api import router as crpt_router

app = FastAPI()


@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    path = request.url.path.lower()
    cacheable_extensions = (".js", ".css", ".html", ".mjs")
    cacheable_paths = {
        "/",
        "/keepalive",
        "/radio",
        "/crpt",
        "/sbor",
        "/time",
    }

    if path.endswith(cacheable_extensions) or path in cacheable_paths:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    return response


os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

os.makedirs("project", exist_ok=True)
app.mount("/project", StaticFiles(directory="project"), name="project")


app.include_router(web_router)
app.include_router(crpt_router)

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
