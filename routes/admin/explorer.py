# routes/admin/explorer.py (НОВЫЙ ФАЙЛ)

import os
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from core import CustomJSONResponse
from logger_config import logger

router = APIRouter()

EXCLUDED_DIRS = {'.git', '__pycache__', '.venv', '.idea'}
EXCLUDED_FILES = {'.DS_Store'}

def build_file_tree(path: str) -> List[Dict[str, Any]]:
    """
    Рекурсивно строит дерево файлов и директорий.
    """
    tree = []
    try:
        # Сортируем, чтобы папки были первыми
        items = sorted(os.listdir(path), key=lambda x: not os.path.isdir(os.path.join(path, x)))
        for item in items:
            item_path = os.path.join(path, item)
            if os.path.isdir(item_path):
                if item not in EXCLUDED_DIRS:
                    tree.append({
                        "name": item,
                        "type": "directory",
                        "children": build_file_tree(item_path)
                    })
            else:
                if item not in EXCLUDED_FILES:
                    tree.append({
                        "name": item,
                        "type": "file"
                    })
    except OSError as e:
        logger.error(f"Ошибка чтения директории {path}: {e}")
    return tree

@router.get("/file-explorer", response_class=CustomJSONResponse)
async def get_file_explorer_tree():
    """
    Возвращает структуру файлов и папок проекта.
    """
    try:
        project_root = "."
        tree = build_file_tree(project_root)
        return tree
    except Exception as e:
        logger.error(f"Не удалось построить дерево файлов: {e}")
        raise HTTPException(status_code=500, detail="Could not build file tree.")