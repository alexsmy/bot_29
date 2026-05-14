import os
import random
import string
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

# Создаем отдельный роутер для модуля шифратора
router = APIRouter(prefix="/api/crpt", tags=["crpt"])

# Папка для сохранения файлов. 
# Вынесена в корень проекта (data/...), чтобы было удобно подключать Persistent Disk на Render
UPLOAD_DIR = "data/crpt_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def generate_id(length=8):
    """Генерация случайного 8-значного ID"""
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

@router.post("/save")
async def save_data(request: Request):
    """Эндпоинт для сохранения зашифрованных данных"""
    data = await request.body()
    
    if not data:
        return JSONResponse({"success": False, "error": "Нет данных для сохранения"})

    if len(data) > 50 * 1024 * 1024:
        return JSONResponse({"success": False, "error": "Файл слишком большой"})

    file_id = generate_id()
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.crpt")

    # Проверка на коллизию ID
    while os.path.exists(file_path):
        file_id = generate_id()
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.crpt")

    try:
        with open(file_path, "wb") as f:
            f.write(data)
        return JSONResponse({"success": True, "id": file_id})
    except Exception as e:
        return JSONResponse({"success": False, "error": "Ошибка записи на диск сервера"})

@router.get("/load")
async def load_data(id: str):
    """Эндпоинт для загрузки данных по ID"""
    # Базовая защита от Path Traversal
    if not id or not id.isalnum():
        return JSONResponse({"success": False, "error": "Неверный формат ID файла"})

    file_path = os.path.join(UPLOAD_DIR, f"{id}.crpt")

    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = f.read()
            return JSONResponse({"success": True, "data": data})
        except Exception as e:
            return JSONResponse({"success": False, "error": "Ошибка чтения файла"})
    else:
        return JSONResponse({"success": False, "error": "Файл не найден или удален"})

@router.delete("/delete/{file_id}")
async def delete_crpt_file(file_id: str):
    """Удаляет файл из CRPT облака по его ID."""
    if not file_id or not file_id.isalnum():
        return JSONResponse({"success": False, "error": "Неверный формат ID файла"}, status_code=400)
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.crpt")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return JSONResponse({"success": True})
        except Exception as e:
            return JSONResponse({"success": False, "error": "Ошибка удаления файла"}, status_code=500)
    else:
        return JSONResponse({"success": False, "error": "Файл не найден"}, status_code=404)