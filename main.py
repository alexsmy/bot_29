import os
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.exception_handlers import http_exception_handler
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

import ice_provider
from logger_config import logger
from websocket_manager import manager
from routes.websocket import router as websocket_router
from routes.admin_router import router as admin_router
from routes.api_router import router as api_router
from core import CustomJSONResponse, templates

# --- ИЗМЕНЕНИЕ: Настройка Rate Limiter ---
limiter = Limiter(key_func=get_remote_address, default_limits=["100 per minute"])

app = FastAPI()

# Применяем Rate Limiter как middleware
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Добавляем обработчик исключений для RateLimitExceeded
@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    logger.warning(f"Rate limit exceeded for {request.client.host}: {exc.detail}")
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )
# --- КОНЕЦ ИЗМЕНЕНИЯ ---


app.include_router(websocket_router)
app.include_router(admin_router)
app.include_router(api_router)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]:
        logger.warning(f"Перехвачена ошибка {exc.status_code} для URL: {request.url}. Показываем invalid_link.html.")
        bot_username = os.environ.get("BOT_USERNAME", "")
        return templates.TemplateResponse(
            "invalid_link.html",
            {"request": request, "bot_username": bot_username},
            status_code=exc.status_code
        )
    return await http_exception_handler(request, exc)

@app.get("/", response_class=HTMLResponse)
async def get_welcome(request: Request):
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse("welcome.html", {"request": request, "bot_username": bot_username})

@app.get("/api/ice-servers", response_class=CustomJSONResponse)
@limiter.limit("10/minute")  # --- ИЗМЕНЕНИЕ: Строгий лимит для этого эндпоинта
async def get_ice_servers_endpoint(request: Request):
    servers = ice_provider.get_ice_servers()
    return servers

@app.get("/call/{room_id}", response_class=HTMLResponse)
@limiter.limit("15/minute") # --- ИЗМЕНЕНИЕ: Строгий лимит для этого эндпоинта
async def get_call_page(request: Request, room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse("call.html", {"request": request, "bot_username": bot_username})

@app.post("/room/close/{room_id}", response_class=CustomJSONResponse)
@limiter.limit("20/minute") # --- ИЗМЕНЕНИЕ: Лимит для этого эндпоинта
async def close_room_endpoint(request: Request, room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    await manager.close_room(room_id, "Closed by user")
    return {"status": "closing"}

@app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
async def catch_all_invalid_paths(request: Request, full_path: str):
    logger.warning(f"Обработан невалидный путь (catch-all): /{full_path}")
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse(
        "invalid_link.html",
        {"request": request, "bot_username": bot_username},
        status_code=status.HTTP_404_NOT_FOUND
    )