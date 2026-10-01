from functools import lru_cache
from importlib.resources import files

from app.features.dashboard.schemas import Dashboard


@lru_cache(maxsize=1)
def get_dashboard() -> Dashboard:
    snapshot = files("app.features.dashboard").joinpath("demo.json").read_text()
    return Dashboard.model_validate_json(snapshot)
