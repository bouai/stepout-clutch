import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/saved-destinations", tags=["saved-destinations"])

EARTH_RADIUS_KM = 6371


def _haversine_distance_km(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(
        lat2_rad
    ) * math.sin(delta_lon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _initial_bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lon = math.radians(lon2 - lon1)
    x = math.sin(delta_lon) * math.cos(lat2_rad)
    y = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(
        lat2_rad
    ) * math.cos(delta_lon)
    bearing = math.degrees(math.atan2(x, y))
    return round(bearing) % 360


@router.get("", response_model=list[schemas.SavedDestination])
def list_saved_destinations(
    trip_id: int | None = Query(default=None, alias="tripId"),
    db: Session = Depends(get_db),
):
    query = db.query(models.SavedDestination)
    if trip_id is not None:
        query = query.filter(models.SavedDestination.trip_id == trip_id)
    return query.all()


@router.get("/{destination_id}", response_model=schemas.SavedDestination)
def get_saved_destination(destination_id: int, db: Session = Depends(get_db)):
    destination = db.get(models.SavedDestination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Saved destination not found")
    return destination


@router.post("", response_model=schemas.SavedDestination, status_code=201)
def create_saved_destination(
    payload: schemas.SavedDestinationCreate, db: Session = Depends(get_db)
):
    destination = models.SavedDestination(**payload.model_dump())
    db.add(destination)
    db.commit()
    db.refresh(destination)
    return destination


@router.delete("/{destination_id}", status_code=204)
def delete_saved_destination(destination_id: int, db: Session = Depends(get_db)):
    destination = db.get(models.SavedDestination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Saved destination not found")

    db.delete(destination)
    db.commit()


@router.get("/{destination_id}/distance", response_model=schemas.Distance)
def get_distance(
    destination_id: int,
    lat: float = Query(...),
    lon: float = Query(...),
    db: Session = Depends(get_db),
):
    destination = db.get(models.SavedDestination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="Saved destination not found")

    distance_km = _haversine_distance_km(
        lat, lon, destination.latitude, destination.longitude
    )
    bearing_degrees = _initial_bearing_degrees(
        lat, lon, destination.latitude, destination.longitude
    )

    return schemas.Distance(
        distance_km=round(distance_km, 1), bearing_degrees=bearing_degrees
    )
