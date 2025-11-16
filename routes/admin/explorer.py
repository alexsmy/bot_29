
import os
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
TEXT_EXTENSIONS = {'.py', '.js', '.css', '.html', '.json', '.txt', '.log', '.md', '.yaml', '.yml', '.toml', '.sh', '.bat'}
NON_TEXT_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.webm', '.mp3', '.wav', '.ogg', '.zip', '.rar', '.7z', '.pdf', '.doc', '.docx', '.xls', '.xlsx'}


# Получаем абсолютный путь к корневой директории проекта
PROJECT_ROOT = os.path.abspath(".")

def is_safe_path(path: str) -> bool:
    """Проверяет, что путь находится внутри корневой директории проекта."""
    resolved_path = os.path.abspath(path)
    return resolved_path.startswith(PROJECT_ROOT)

def get_project_files_flat(current_path: str, all_files: List) -> None:
    """
    Рекурсивно сканирует директории и собирает плоский список файлов.
    """
    try:
        items = os.listdir(current_path)
        for item in items:
            item_path = os.path.join(current_path, item)
            if not is_safe_path(item_path):
                continue

            if os.path.isdir(item_path):
                if item not in EXCLUDED_DIRS:
                    get_project_files_flat(item_path, all_files)
            else:
                if item not in EXCLUDED_FILES:
                    try:
                        stats = os.stat(item_path)
                        all_files.append({
                            "name": item,
                            "path": os.path.relpath(item_path, PROJECT_ROOT),
                            "size": stats.st_size,
                            "modified": datetime.fromtimestamp(stats.st_mtime).isoformat()
                        })
                    except OSError:
                        continue
    except OSError as e:
        log("ERROR", f"Ошибка чтения директории {current_path}: {e}", level=logging.ERROR)

@router.get("/explorer/files-flat", response_class=CustomJSONResponse)
async def get_files_flat():
    """
    Возвращает плоский список всех файлов проекта для Tabulator.
    """
    try:
        all_files = []
        get_project_files_flat(PROJECT_ROOT, all_files)
        return all_files
    except Exception as e:
        log("ERROR", f"Не удалось построить плоский список файлов: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Could not build file list.")

@router.get("/explorer/file-content", response_class=CustomJSONResponse)
async def get_file_content(path: str = Query(...)):
    """
    Возвращает содержимое текстового файла.
    """
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
            content = f.read(1024 * 500) # 500 KB limit
        return {"content": content, "lang": extension.lower().strip('.')}
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Cannot decode file content. It might be a binary file.")
    except Exception as e:
        log("ERROR", f"Ошибка чтения файла {path}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail="Could not read file.")

@router.get("/explorer/file-download")
async def download_file(path: str = Query(...)):
    """
    Предоставляет файл для скачивания или стриминга.
    """
    if not is_safe_path(path):
        raise HTTPException(status_code=403, detail="Forbidden: Access denied.")

    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found.")
    
    return FileResponse(path, filename=os.path.basename(path))

@router.delete("/explorer/file", response_class=CustomJSONResponse)
async def delete_file(path: str = Query(...)):
    """
    Удаляет указанный файл.
    """
    if not is_safe_path(path):
        raise HTTPException(status_code=403, detail="Forbidden: Access denied.")
    
    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found.")
        
    # Простое ограничение: запрещаем удалять файлы кода и конфигурации
    _, extension = os.path.splitext(path)
    protected_extensions = {'.py', '.json', '.html', '.css', '.js', '.md', '.txt'}
    if extension.lower() in protected_extensions and 'call_records' not in path:
         raise HTTPException(status_code=403, detail="Forbidden: Deleting this file type is not allowed.")

    try:
        os.remove(path)
        log("ADMIN_ACTION", f"Администратор удалил файл: {path}", level=logging.WARNING)
        return {"status": "deleted", "path": path}
    except Exception as e:
        log("ERROR", f"Ошибка при удалении файла {path}: {e}", level=logging.ERROR)
        raise HTTPException(status_code=500, detail=f"Could not delete file: {e}")