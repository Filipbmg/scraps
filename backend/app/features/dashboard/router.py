from fastapi import APIRouter

from app.features.dashboard.schemas import Dashboard
from app.features.dashboard.service import get_dashboard

router = APIRouter()


@router.get("", response_model=Dashboard)
def dashboard() -> Dashboard:
    return get_dashboard()
