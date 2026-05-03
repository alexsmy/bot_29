import os
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
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
    
    # Если папки или файла нет, отдаем заглушку
    if not os.path.exists(template_path):
        return HTMLResponse(content="<h1>Ошибка: Файл шаблона templates/index.html не найден.</h1>", status_code=404)
        
    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    return HTMLResponse(content=html_content)