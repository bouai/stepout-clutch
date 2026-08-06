from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import (
    checklist_items,
    geofence_triggers,
    inventory_items,
    saved_destinations,
    weather,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="StepOut API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(checklist_items.router)
app.include_router(inventory_items.router)
app.include_router(geofence_triggers.router)
app.include_router(saved_destinations.router)
app.include_router(weather.router)


@app.get("/health")
def health():
    return {"status": "ok"}
