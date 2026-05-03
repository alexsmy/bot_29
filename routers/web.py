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
    """Отдает главную страницу с красивым дашбордом."""
    template_path = os.path.join("templates", "index.html")

    if not os.path.exists(template_path):
        return HTMLResponse(content="<h1>Ошибка: Файл шаблона templates/index.html не найден.</h1>", status_code=404)

    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    return HTMLResponse(content=html_content)

# --- НОВЫЙ МОДУЛЬНЫЙ БЛОК ---
@router.get("/radio")
async def radio_redirect():
    """
    Удобный эндпоинт для доступа к радио.
    Делает редирект на фактическое расположение файла, 
    сохраняя правильную работу всех относительных путей (CSS/JS) внутри HTML.
    """
    return RedirectResponse(url="/project/radio/radio_18.html")
# ----------------------------