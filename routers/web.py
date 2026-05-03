import os
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse
from services.stats_manager import get_all_stats

router = APIRouter()

@router.get("/api/stats")
async def api_stats():
    """API эндпоинт, возвращающий текущую статистику в формате JSON."""
    return {"stats": get_all_stats()}

@router.get("/")
async def dashboard():
    """Отдает главную страницу (Хаб проектов)."""
    template_path = os.path.join("templates", "index.html")

    if not os.path.exists(template_path):
        return HTMLResponse(content="<h1>Ошибка: Файл шаблона templates/index.html не найден.</h1>", status_code=404)

    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    return HTMLResponse(content=html_content)

@router.get("/keepalive")
async def keepalive_page():
    """Отдает страницу статистики автоподдержки."""
    template_path = os.path.join("templates", "keepalive.html")

    if not os.path.exists(template_path):
        return HTMLResponse(content="<h1>Ошибка: Файл шаблона templates/keepalive.html не найден.</h1>", status_code=404)

    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    return HTMLResponse(content=html_content)

@router.get("/radio")
async def radio_redirect():
    return RedirectResponse(url="/project/radio/radio_18.html")

@router.get("/crpt")
async def crpt_redirect():
    return RedirectResponse(url="/project/crpt/crpt.html")

@router.get("/sbor")
async def sbor_redirect():
    return RedirectResponse(url="/project/sbor/sbor.html")