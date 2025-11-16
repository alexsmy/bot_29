from fastapi import APIRouter, Depends

from .admin import (
    auth, connections, danger_zone, reports, rooms, stats, users, views, explorer
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
api_router.include_router(explorer.router, tags=["Explorer"])
api_router.include_router(danger_zone.router, tags=["Danger Zone"])

router.include_router(views.router)
router.include_router(api_router)