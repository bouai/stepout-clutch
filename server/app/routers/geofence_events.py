from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/geofence-events", tags=["geofence-events"])


@router.get("", response_model=list[schemas.GeofenceEvent])
def list_geofence_events(
    trip_id: int | None = Query(default=None, alias="tripId"),
    limit: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(models.GeofenceEvent)
    if trip_id is not None:
        query = query.filter(models.GeofenceEvent.trip_id == trip_id)
    query = query.order_by(models.GeofenceEvent.fired_at.desc())
    if limit is not None:
        query = query.limit(limit)
    return query.all()


@router.post("", response_model=schemas.GeofenceEvent, status_code=201)
def create_geofence_event(
    payload: schemas.GeofenceEventCreate, db: Session = Depends(get_db)
):
    trigger = db.get(models.GeofenceTrigger, payload.trigger_id)
    if trigger is None:
        raise HTTPException(status_code=404, detail="Geofence trigger not found")

    # An event belongs to whatever trip its trigger belongs to; the client never
    # supplies this, so the two can't drift apart.
    event = models.GeofenceEvent(**payload.model_dump(), trip_id=trigger.trip_id)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
