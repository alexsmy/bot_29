import json
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

import database
from core import CustomJSONResponse
from configurable_logger import log

router = APIRouter()

@router.get("/users", response_class=CustomJSONResponse)
async def get_admin_users():
    users = await database.get_users_info()
    return users

@router.get("/user_actions/{user_id}", response_class=CustomJSONResponse)
async def get_admin_user_actions(user_id: int):
    actions = await database.get_user_actions(user_id)
    return actions

@router.get("/users/all_actions", response_class=CustomJSONResponse)
async def get_all_user_actions():
    actions = await database.get_all_actions()
    return actions

@router.post("/user/{user_id}/block", response_class=CustomJSONResponse)
async def block_user(user_id: int):
    try:
        await database.update_user_status(user_id, 'blocked')
        return {"status": "ok", "message": f"User {user_id} blocked."}
    except Exception as e:
        log("ERROR", f"Ошибка при блокировке пользователя {user_id}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Failed to block user.")

@router.post("/user/{user_id}/unblock", response_class=CustomJSONResponse)
async def unblock_user(user_id: int):
    try:
        await database.update_user_status(user_id, 'active')
        await database.forgive_spam_strikes(user_id)
        return {"status": "ok", "message": f"User {user_id} unblocked and strikes forgiven."}
    except Exception as e:
        log("ERROR", f"Ошибка при разблокировке пользователя {user_id}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Failed to unblock user.")

@router.delete("/user/{user_id}", response_class=CustomJSONResponse)
async def delete_user_by_admin(user_id: int):
    try:
        await database.delete_user(user_id)
        return {"status": "ok", "message": f"User {user_id} deleted."}
    except Exception as e:
        log("ERROR", f"Ошибка при удалении пользователя {user_id}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Failed to delete user.")

@router.get("/users/export", response_class=JSONResponse)
async def export_users_data():
    try:
        users = await database.get_users_info()
        actions = await database.get_all_actions()
        
        data_to_export = {
            "export_date": datetime.utcnow().isoformat(),
            "users": users,
            "actions": actions
        }
        
        headers = {
            'Content-Disposition': f'attachment; filename="users_export_{datetime.utcnow().strftime("%Y%m%d")}.json"'
        }
        
        # Используем стандартный JSONResponse для корректной сериализации datetime
        def json_default(o):
            if isinstance(o, (datetime,)):
                return o.isoformat()
        
        return JSONResponse(
            content=json.loads(json.dumps(data_to_export, default=json_default)),
            headers=headers
        )
    except Exception as e:
        log("ERROR", f"Ошибка при экспорте данных пользователей: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Failed to export data.")

@router.post("/users/import", response_class=CustomJSONResponse)
async def import_users_data(file: UploadFile = File(...)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JSON file.")
    
    try:
        contents = await file.read()
        data = json.loads(contents)
        
        await database.import_users_and_actions(data)
        
        return {"status": "ok", "message": "Data imported successfully."}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")
    except Exception as e:
        log("ERROR", f"Ошибка при импорте данных пользователей: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail=f"Failed to import data: {e}")