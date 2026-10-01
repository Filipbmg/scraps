from fastapi import APIRouter

from app.api.health import router as health_router
from app.features.collection.router import router as collection_router
from app.features.dashboard.router import router as dashboard_router

router = APIRouter()
router.include_router(health_router)
router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
router.include_router(collection_router, prefix="/collection", tags=["collection"])
