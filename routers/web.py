import os
import time
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse
from services.stats_manager import get_all_stats

router = APIRouter()


def _asset_version() -> str:
    return str(int(time.time()))


def _render_template_with_version(template_path: str) -> HTMLResponse:
    if not os.path.exists(template_path):
        return HTMLResponse(content=f"<h1>Ошибка: Файл шаблона {template_path} не найден.</h1>", status_code=404)

    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    html_content = html_content.replace("__ASSET_VERSION__", _asset_version())
    return HTMLResponse(content=html_content)


@router.get("/api/stats")
async def api_stats():
    """API эндпоинт, возвращающий текущую статистику в формате JSON."""
    return {"stats": get_all_stats()}


@router.get("/")
async def dashboard():
    """Отдает главную страницу (Хаб проектов)."""
    template_path = os.path.join("templates", "index.html")
    return _render_template_with_version(template_path)


@router.get("/keepalive")
async def keepalive_page():
    """Отдает страницу статистики автоподдержки."""
    template_path = os.path.join("templates", "keepalive.html")
    return _render_template_with_version(template_path)


@router.get("/radio")
async def radio_redirect():
    return RedirectResponse(url=f"/project/radio/radio_18.html?v={_asset_version()}")


@router.get("/crpt")
async def crpt_redirect():
    return RedirectResponse(url=f"/project/crpt/crpt.html?v={_asset_version()}")


@router.get("/sbor")
async def sbor_redirect():
    return RedirectResponse(url=f"/project/sbor/sbor.html?v={_asset_version()}")


@router.get("/time")
async def time_redirect():
    return RedirectResponse(url=f"/project/time/3dtime.html?v={_asset_version()}")
