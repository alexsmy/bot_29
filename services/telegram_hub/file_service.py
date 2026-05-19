from pathlib import Path
from services.telegram_hub.config import FILEVAULT_DIR

def ensure_storage():
    Path(FILEVAULT_DIR).mkdir(parents=True, exist_ok=True)

def get_items(folder=""):
    ensure_storage()

    target = Path(FILEVAULT_DIR) / folder
    target.mkdir(parents=True, exist_ok=True)

    folders = []
    files = []

    for item in sorted(target.iterdir()):
        if item.is_dir():
            folders.append(item)
        else:
            files.append(item)

    return folders, files

def format_size(size):
    kb = 1024
    mb = kb * 1024
    gb = mb * 1024

    if size >= gb:
        return f"{round(size / gb, 1)}Гб"
    if size >= mb:
        return f"{round(size / mb, 1)}Мб"
    if size >= kb:
        return f"{round(size / kb, 1)}Кб"

    return f"{size}Б"
