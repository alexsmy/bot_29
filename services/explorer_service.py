import os
import shutil
import logging
from datetime import datetime
from typing import List, Dict, Any

from configurable_logger import log

EXCLUDED_DIRS = {'.git', '__pycache__', '.venv', '.idea', 'node_modules'}
EXCLUDED_FILES = {'.DS_Store'}
TEXT_EXTENSIONS = {'.py', '.js', '.css', '.html', '.json', 'jsonc', '.txt', '.log', '.md', '.yaml', '.yml', '.toml', '.sh', '.bat'}
NON_TEXT_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.webm', '.mp3', '.wav', '.ogg', '.zip', '.rar', '.7z', '.pdf', '.doc', '.docx', '.xls', '.xlsx'}

PROJECT_ROOT = os.path.abspath(".")
CALL_RECORDS_PATH = os.path.join(PROJECT_ROOT, "call_records")
APP_LOG_PATH = os.path.join(PROJECT_ROOT, "app.log")

def _is_safe_path(path: str) -> bool:
    resolved_path = os.path.abspath(path)
    return resolved_path.startswith(PROJECT_ROOT)

def _is_deletable(path: str) -> bool:
    resolved_path = os.path.abspath(path)
    is_in_records = resolved_path.startswith(CALL_RECORDS_PATH)
    is_app_log = resolved_path == APP_LOG_PATH
    return is_in_records or is_app_log

def _build_file_tree_recursive(path: str) -> List[Dict[str, Any]]:
    tree = []
    try:
        items = sorted(os.listdir(path), key=lambda x: not os.path.isdir(os.path.join(path, x)))
        for item in items:
            item_path = os.path.join(path, item)
            if not _is_safe_path(item_path):
                continue

            if os.path.isdir(item_path):
                if item not in EXCLUDED_DIRS:
                    tree.append({
                        "name": item,
                        "type": "directory",
                        "path": os.path.relpath(item_path, PROJECT_ROOT),
                        "children": _build_file_tree_recursive(item_path)
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

def get_file_tree() -> List[Dict[str, Any]]:
    return _build_file_tree_recursive(PROJECT_ROOT)

def get_file_content_as_text(path: str) -> Dict[str, str]:
    if not _is_safe_path(path):
        raise PermissionError("Access denied.")
    
    if not os.path.exists(path) or not os.path.isfile(path):
        raise FileNotFoundError("File not found.")

    _, extension = os.path.splitext(path)
    if extension.lower() in NON_TEXT_EXTENSIONS:
        raise ValueError("Cannot view this file type as text.")
    if extension.lower() not in TEXT_EXTENSIONS:
        log("ADMIN_ACTION", f"Попытка просмотра файла с неизвестным расширением '{extension}' как текста.", level=logging.WARNING)

    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read(1024 * 500)
        return {"content": content, "lang": extension.lower().strip('.')}
    except UnicodeDecodeError:
        raise ValueError("Cannot decode file content. It might be a binary file.")
    except Exception as e:
        log("ERROR", f"Ошибка чтения файла {path}: {e}", level=logging.ERROR)
        raise IOError("Could not read file.")

def delete_explorer_item(path: str):
    if not _is_safe_path(path) or not _is_deletable(path):
        raise PermissionError("Deletion of this item is not allowed.")

    if not os.path.exists(path):
        raise FileNotFoundError("Item not found.")

    try:
        if os.path.isfile(path):
            os.remove(path)
            log("ADMIN_ACTION", f"Администратор удалил файл: {path}", level=logging.WARNING)
        elif os.path.isdir(path):
            shutil.rmtree(path)
            log("ADMIN_ACTION", f"Администратор удалил папку: {path}", level=logging.WARNING)
    except Exception as e:
        log("ERROR", f"Ошибка при удалении {path}: {e}", level=logging.ERROR)
        raise IOError(f"Could not delete item: {e}")

def validate_file_for_download(path: str):
    if not _is_safe_path(path):
        raise PermissionError("Access denied.")
    if not os.path.exists(path) or not os.path.isfile(path):
        raise FileNotFoundError("File not found.")