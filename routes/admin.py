# routes/admin.py

import glob
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, FileResponse, PlainTextResponse, Response

import database
from config import PRIVATE_ROOM_LIFETIME_HOURS
from core.schemas import NotificationSettings
from logger_config import logger, LOG_FILE_PATH
# v-- ИЗМЕНЕНИЕ: Импортируем общие компоненты из нового файла --v
from core.app_setup import CustomJSONResponse, templates, LOGS_DIR
from websocket_manager import manager

router = APIRouter()

async def verify_admin_token(request: Request, token: str):
    expires_at = await database.get_admin_token_expiry(token)
    if not expires_at:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or expired token")
    request.state.token_expires_at = expires_at
    return token

def sanitize_filename(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return filename

@router.get("/admin/{token}", response_class=HTMLResponse, tags=["Admin"])
async def get_admin_page(request: Request, token: str = Depends(verify_admin_token)):
    expires_at_iso = request.state.token_expires_at.isoformat()
    return templates.TemplateResponse("admin.html", {"request": request, "token": token, "expires_at": expires_at_iso})

@router.get("/api/admin/stats", tags=["Admin API"])
async def get_admin_stats(period: str = "all", token: str = Depends(verify_admin_token)):
    stats = await database.get_stats(period)
    return CustomJSONResponse(content=stats)

@router.get("/api/admin/users", tags=["Admin API"])
async def get_admin_users(token: str = Depends(verify_admin_token)):
    users = await database.get_users_info()
    return CustomJSONResponse(content=users)

@router.get("/api/admin/user_actions/{user_id}", tags=["Admin API"])
async def get_admin_user_actions(user_id: int, token: str = Depends(verify_admin_token)):
    actions = await database.get_user_actions(user_id)
    return CustomJSONResponse(content=actions)

@router.get("/api/admin/connections", tags=["Admin API"])
async def get_admin_connections(date: str, token: str = Depends(verify_admin_token)):
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    connections = await database.get_connections_info(date_obj)
    return CustomJSONResponse(content=connections)

@router.get("/api/admin/active_rooms", tags=["Admin API"])
async def get_active_rooms(token: str = Depends(verify_admin_token)):
    active_sessions_from_db = await database.get_all_active_sessions()
    
    active_rooms_info = []
    for session in active_sessions_from_db:
        created_at = session['created_at']
        expires_at = session['expires_at']
        room_id = session['room_id']

        lifetime_seconds = (expires_at - created_at).total_seconds()
        lifetime_hours = round(lifetime_seconds / 3600)
        
        remaining_seconds = (expires_at - datetime.now(timezone.utc)).total_seconds()
        
        is_admin_room = lifetime_hours > PRIVATE_ROOM_LIFETIME_HOURS
        
        user_count = 0
        if room_id in manager.rooms:
            user_count = len(manager.rooms[room_id].users)

        active_rooms_info.append({
            "room_id": room_id,
            "lifetime_hours": lifetime_hours,
            "remaining_seconds": max(0, remaining_seconds),
            "is_admin_room": is_admin_room,
            "user_count": user_count,
            "call_status": session.get('status'),
            "call_type": session.get('call_type')
        })
        
    return CustomJSONResponse(content=active_rooms_info)

@router.delete("/api/admin/room/{room_id}", tags=["Admin API"])
async def close_room_by_admin(room_id: str, token: str = Depends(verify_admin_token)):
    if room_id in manager.rooms:
        logger.info(f"Администратор принудительно закрывает комнату (из памяти): {room_id}")
        await manager.close_room(room_id, "Closed by admin")
    else:
        logger.info(f"Администратор принудительно закрывает комнату (из БД): {room_id}")
        await database.log_room_closure(room_id, "Closed by admin")
        
    return CustomJSONResponse(content={"status": "room closed", "room_id": room_id})

@router.get("/api/admin/notification_settings", tags=["Admin API"])
async def get_notification_settings_endpoint(token: str = Depends(verify_admin_token)):
    settings = await database.get_notification_settings()
    return CustomJSONResponse(content=settings)

@router.post("/api/admin/notification_settings", tags=["Admin API"])
async def update_notification_settings_endpoint(settings: NotificationSettings, token: str = Depends(verify_admin_token)):
    await database.update_notification_settings(settings.dict())
    return CustomJSONResponse(content={"status": "ok"})

@router.get("/api/admin/reports", tags=["Admin API"])
async def list_reports(token: str = Depends(verify_admin_token)):
    try:
        files = glob.glob(os.path.join(LOGS_DIR, "*.html"))
        filenames = sorted([os.path.basename(f) for f in files], reverse=True)
        return CustomJSONResponse(content=filenames)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reports: {e}")

@router.get("/admin/reports/{filename}", tags=["Admin"])
async def get_report(filename: str, download: bool = False, token: str = Depends(verify_admin_token)):
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(LOGS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found.")
    
    headers = {}
    if download:
        headers["Content-Disposition"] = f"attachment; filename={safe_filename}"
        
    return FileResponse(path=filepath, headers=headers, media_type='text/html')

@router.delete("/api/admin/reports/{filename}", tags=["Admin API"])
async def delete_report(filename: str, token: str = Depends(verify_admin_token)):
    safe_filename = sanitize_filename(filename)
    filepath = os.path.join(LOGS_DIR, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found.")
    try:
        os.remove(filepath)
        return CustomJSONResponse(content={"status": "deleted", "filename": safe_filename})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {e}")

@router.delete("/api/admin/reports", tags=["Admin API"])
async def delete_all_reports(token: str = Depends(verify_admin_token)):
    try:
        files = glob.glob(os.path.join(LOGS_DIR, "*.html"))
        for f in files:
            os.remove(f)
        return CustomJSONResponse(content={"status": "all deleted", "count": len(files)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete all reports: {e}")

@router.get("/api/admin/logs", response_class=PlainTextResponse, tags=["Admin API"])
async def get_app_logs(token: str = Depends(verify_admin_token)):
    try:
        if not os.path.exists(LOG_FILE_PATH):
            return "Файл логов еще не создан."
        with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Ошибка чтения файла логов: {e}")
        raise HTTPException(status_code=500, detail="Could not read log file.")

@router.get("/api/admin/logs/download", tags=["Admin API"])
async def download_app_logs(token: str = Depends(verify_admin_token)):
    if not os.path.exists(LOG_FILE_PATH):
        raise HTTPException(status_code=404, detail="Log file not found.")
    try:
        with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(
            content=content,
            media_type='text/plain',
            headers={"Content-Disposition": "attachment; filename=app.log"}
        )
    except Exception as e:
        logger.error(f"Ошибка при чтении файла логов для скачивания: {e}")
        raise HTTPException(status_code=500, detail="Could not read log file for download.")

@router.delete("/api/admin/logs", tags=["Admin API"])
async def clear_app_logs(token: str = Depends(verify_admin_token)):
    try:
        if os.path.exists(LOG_FILE_PATH):
            with open(LOG_FILE_PATH, 'w') as f:
                f.truncate(0)
            logger.info("Файл логов был очищен администратором.")
            return CustomJSONResponse(content={"status": "log file cleared"})
        return CustomJSONResponse(content={"status": "log file not found"})
    except Exception as e:
        logger.error(f"Ошибка при очистке файла логов: {e}")
        raise HTTPException(status_code=500, detail="Could not clear log file.")

@router.delete("/api/admin/database", tags=["Admin API"])
async def clear_database(token: str = Depends(verify_admin_token)):
    try:
        await database.clear_all_data()
        return CustomJSONResponse(content={"status": "database cleared successfully"})
    except Exception as e:
        logger.error(f"Ошибка при очистке базы данных: {e}")
        raise HTTPException(status_code=500, detail=f"Database clearing failed: {e}")