import os
import shutil
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import List, Dict, Any

from core import CustomJSONResponse
from configurable_logger import log

router = APIRouter()

EXCLUDED_DIRS = {'.git', '__pycache__', '.venv', '.idea', 'node_modules'}
EXCLUDED_FILES = {'.DS_Store'}
TEXT_EXTENSIONS = {'.py', '.js', '.css', '.html', '.json', 'jsonc', '.txt', '.log', '.md', '.yaml', '.yml', '.toml', '.sh', '.bat'}
NON_TEXT_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.webm', '.mp3', '.wav', '.ogg', '.zip', '.rar', '.7z', '.pdf', '.doc', '.docx', '.xls', '.xlsx'}

PROJECT_ROOT = os.path.abspath(".")
CALL_RECORDS_PATH = os.path.join(PROJECT_ROOT, "call_records")
APP_LOG_PATH = os.path.join(PROJECT_ROOT, "app.log")

def is_safe_path(path: str) -> bool:
    resolved_path = os.path.abspath(path)
    return resolved_path.startswith(PROJECT_ROOT)

def is_deletable(path: str) -> bool:
    resolved_path = os.path.abspath(path)
    is_in_records = resolved_path.startswith(CALL_RECORDS_PATH)
    is_app_log = resolved_path == APP_LOG_PATH
    return is_in_records or is_app_log

def build_file_tree(path: str) -> List[Dict[str, Any]]:
    tree = []
    try:
        items = sorted(os.listdir(path), key=lambda x: not os.path.isdir(os.path.join(path, x)))
        for item in items:
            item_path = os.path.join(path, item)
            if not is_safe_path(item_path):
                continue

            if os.path.isdir(item_path):
                if item not in EXCLUDED_DIRS:
                    tree.append({
                        "name": item,
                        "type": "directory",
                        "path": os.path.relpath(item_path, PROJECT_ROOT),
                        "children": build_file_tree(item_path)
                    })
            else:
                if item not in EXCLUDED_FILES:
                    try:
                        stats = os.stat(item_path)
                        tree.append({
                            "name": item,
                            "type": "file",
                            "path": os.path.relpath(item_path, PROJECT_ROOT),
                            "size": stats.st_size,
                            "modified": datetime.fromtimestamp(stats.st_mtime).isoformat()
                        })
                    except OSError:
                        continue
    except OSError as e:
        log("ERROR", f"Ошибка чтения директории {path}: {e}", level=logging.ERROR)
    return tree

@router.get("/file-explorer", response_class=CustomJSONResponse)
async def get_file_explorer_tree():
    try:
        tree = build_file_tree(PROJECT_ROOT)
        return tree
    except Exception as e:
        log("ERROR", f"Не удалось построить дерево файлов: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Could not build file tree.")

@router.get("/explorer/file-content", response_class=CustomJSONResponse)
async def get_file_content(path: str = Query(...)):
    if not is_safe_path(path):
        raise HTTPException(status_code=403, detail="Forbidden: Access denied.")
    
    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found.")

    _, extension = os.path.splitext(path)
    if extension.lower() in NON_TEXT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Cannot view this file type as text.")
    if extension.lower() not in TEXT_EXTENSIONS:
        log("ADMIN_ACTION", f"Попытка просмотра файла с неизвестным расширением '{extension}' как текста.", level=logging.WARNING)

    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read(1024 * 500)
        return {"content": content, "lang": extension.lower().strip('.')}
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Cannot decode file content. It might be a binary file.")
    except Exception as e:
        log("ERROR", f"Ошибка чтения файла {path}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Could not read file.")

@router.get("/explorer/file-download")
async def download_file(path: str = Query(...)):
    if not is_safe_path(path):
        raise HTTPException(status_code=403, detail="Forbidden: Access denied.")

    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found.")
    
    return FileResponse(path, filename=os.path.basename(path))

@router.delete("/explorer/file", response_class=CustomJSONResponse)
async def delete_file(path: str = Query(...)):
    if not is_safe_path(path) or not is_deletable(path):
        raise HTTPException(status_code=403, detail="Forbidden: Deletion of this file is not allowed.")

    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found.")

    try:
        os.remove(path)
        log("ADMIN_ACTION", f"Администратор удалил файл: {path}", level=logging.WARNING)
        return {"status": "deleted", "path": path}
    except Exception as e:
        log("ERROR", f"Ошибка при удалении файла {path}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail=f"Could not delete file: {e}")

@router.delete("/explorer/folder", response_class=CustomJSONResponse)
async def delete_folder(path: str = Query(...)):
    if not is_safe_path(path) or not is_deletable(path):
        raise HTTPException(status_code=403, detail="Forbidden: Deletion of this folder is not allowed.")

    if not os.path.exists(path) or not os.path.isdir(path):
        raise HTTPException(status_code=404, detail="Folder not found.")

    try:
        shutil.rmtree(path)
        log("ADMIN_ACTION", f"Администратор удалил папку: {path}", level=logging.WARNING)
        return {"status": "deleted", "path": path}
    except Exception as e:
        log("ERROR", f"Ошибка при удалении папки {path}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail=f"Could not delete folder: {e}")