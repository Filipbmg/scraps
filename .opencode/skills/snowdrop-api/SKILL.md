---
name: snowdrop-api
description: Extend Snowdrop's modular Python FastAPI backend or its dashboard API contract. Use when adding backend features, changing sample data, or connecting frontend functionality to the API.
---

# Snowdrop API

- `app/main.py` creates the application. `app/api/router.py` composes feature routers under `/api`; health is `GET /api/health` with mode `local`.
- Each feature lives in `app/features/<feature>/` with its own `router.py`, `schemas.py`, and `service.py` as needed. Routes handle HTTP, Pydantic models define contracts, services own feature logic. Add layers only when they have work to do.
- Dashboard contract: `GET /api/dashboard`. It returns a validated, immutable-in-practice demo snapshot with `7d`/`30d` periods, metrics, trends, sentiments, sources, mentions, and activity.
- `demo.json` is loaded through `importlib.resources`, packaged with setuptools, and validated once through `lru_cache`. Never mutate the cached model to simulate persistence.
- Keep trend totals equal to period mention totals, sentiment percentages summing to 100, and mention source IDs referencing known sources. The API contract test checks these invariants.
- The frontend uses same-origin `/api` requests through Vite's development proxy. Add narrowly scoped CORS only if deployment actually separates origins.
- Dependencies live in `pyproject.toml`; `uv.lock` pins resolution. Use `uv sync --extra dev`, `uv run uvicorn app.main:app --reload`, and `uv run --extra dev python -m unittest discover -s tests -v` from `backend/`.
- Tests use stdlib async unittest with httpx's ASGI transport. This exercises the real application without opening a network port.
- `app/features/collection/` owns real ingestion, its SQLite store, provider connectors, and a separate worker. Its API is under `/api/collection`; use the `snowdrop-collectors` skill for that feature. The existing `/api/dashboard` remains an explicitly labeled demo contract.
- Interactive API documentation is at `/docs`. Collector credentials live in local environment/session files, never response models or committed configuration. Run the API on `127.0.0.1` for the local operator workflow.
