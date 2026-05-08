
import os

from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse

from config.config_manager import load_raw_config, save_advanced_config
from services.stats_manager import get_all_stats

router = APIRouter()

@router.get("/api/stats")
async def api_stats():
    return {"stats": get_all_stats()}

@router.get("/api/keepalive/config")
async def get_keepalive_config():
    return load_raw_config()

@router.post("/api/keepalive/config")
async def update_keepalive_config(payload: dict):
    return save_advanced_config(payload)

@router.get("/")
async def dashboard():
    template_path = os.path.join("templates", "index.html")

    with open(template_path, "r", encoding="utf-8") as file:
        return HTMLResponse(content=file.read())

@router.get("/keepalive")
async def keepalive_page():
    template_path = os.path.join("templates", "keepalive.html")

    with open(template_path, "r", encoding="utf-8") as file:
        return HTMLResponse(content=file.read())

@router.get("/radio")
async def radio_redirect():
    return RedirectResponse(url="/project/radio/radio_18.html")

@router.get("/crpt")
async def crpt_redirect():
    return RedirectResponse(url="/project/crpt/crpt.html")

@router.get("/sbor")
async def sbor_redirect():
    return RedirectResponse(url="/project/sbor/sbor.html")

@router.get("/time")
async def time_redirect():
    return RedirectResponse(url="/project/time/3dtime.html")
