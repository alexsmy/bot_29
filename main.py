import os
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.exception_handlers import http_exception_handler
from fastapi.staticfiles import StaticFiles

import ice_provider
from logger_config import logger
from websocket_manager import manager
from routes.websocket import router as websocket_router
from routes.admin_router import router as admin_router
from routes.api_router import router as api_router
from core import CustomJSONResponse, templates

app = FastAPI()

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
async def get_ice_servers_endpoint():
    servers = ice_provider.get_ice_servers()
    return servers

@app.get("/call/{room_id}", response_class=HTMLResponse)
async def get_call_page(request: Request, room_id: str):
    room = await manager.get_or_restore_room(room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    bot_username = os.environ.get("BOT_USERNAME", "")
    return templates.TemplateResponse("call.html", {"request": request, "bot_username": bot_username})

@app.post("/room/close/{room_id}", response_class=CustomJSONResponse)
async def close_room_endpoint(room_id: str):
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