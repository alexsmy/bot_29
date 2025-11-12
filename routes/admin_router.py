from fastapi import APIRouter, Depends

from .admin import (
    auth, connections, danger_zone, logs, reports, rooms, settings, stats, users, views, recordings
)

router = APIRouter()

api_router = APIRouter(
    prefix="/api/admin",
    dependencies=[Depends(auth.verify_admin_token)]
)

api_router.include_router(stats.router, tags=["Stats"])
api_router.include_router(users.router, tags=["Users"])
api_router.include_router(rooms.router, tags=["Rooms"])
api_router.include_router(connections.router, tags=["Connections"])
api_router.include_router(settings.router, tags=["Settings"])
api_router.include_router(reports.router, tags=["Reports"])
api_router.include_router(recordings.router, tags=["Recordings"])
api_router.include_router(logs.router, tags=["Logs"])
api_router.include_router(danger_zone.router, tags=["Danger Zone"])

router.include_router(views.router)
router.include_router(api_router)