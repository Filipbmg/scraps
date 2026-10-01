from fastapi import FastAPI

from app.api.router import router

app = FastAPI(
    title="Snowdrop API",
    description="Media monitoring workspace with a demo dashboard and a separate collected-data workspace.",
    version="0.2.0",
)
app.include_router(router, prefix="/api")
