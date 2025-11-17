import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from core import CustomJSONResponse
from services import explorer_service

router = APIRouter()

@router.get("/file-explorer", response_class=CustomJSONResponse)
async def get_file_explorer_tree():
    try:
        tree = explorer_service.get_file_tree()
        return tree
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not build file tree: {e}")

@router.get("/explorer/file-content", response_class=CustomJSONResponse)
async def get_file_content(path: str = Query(...)):
    try:
        content_data = explorer_service.get_file_content_as_text(path)
        return content_data
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Forbidden: {e}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except IOError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/explorer/file-download")
async def download_file(path: str = Query(...)):
    try:
        explorer_service.validate_file_for_download(path)
        return FileResponse(path, filename=os.path.basename(path))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Forbidden: {e}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/explorer/file", response_class=CustomJSONResponse)
async def delete_file(path: str = Query(...)):
    try:
        explorer_service.delete_explorer_item(path)
        return {"status": "deleted", "path": path}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Forbidden: {e}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IOError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/explorer/folder", response_class=CustomJSONResponse)
async def delete_folder(path: str = Query(...)):
    try:
        explorer_service.delete_explorer_item(path)
        return {"status": "deleted", "path": path}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Forbidden: {e}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IOError as e:
        raise HTTPException(status_code=500, detail=str(e))