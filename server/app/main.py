import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import (
    checklist_items,
    geofence_events,
    geofence_triggers,
    inventory_items,
    saved_destinations,
    trips,
    weather,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="StepOut API", lifespan=lifespan)

# React Native does not enforce CORS, so `*` costs nothing for the app itself —
# but it also exposes a deployed API to any web page. Narrow it by setting
# ALLOWED_ORIGINS (comma-separated) in the deploy environment.
_origins = os.getenv("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _origins == "*" else [o.strip() for o in _origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(checklist_items.router)
app.include_router(inventory_items.router)
app.include_router(geofence_triggers.router)
app.include_router(saved_destinations.router)
app.include_router(weather.router)
app.include_router(trips.router)
app.include_router(geofence_events.router)


@app.get("/health")
def health():
    return {"status": "ok"}
