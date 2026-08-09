from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/geofence-events", tags=["geofence-events"])


@router.get("", response_model=list[schemas.GeofenceEvent])
def list_geofence_events(
    limit: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(models.GeofenceEvent).order_by(
        models.GeofenceEvent.fired_at.desc()
    )
    if limit is not None:
        query = query.limit(limit)
    return query.all()


@router.post("", response_model=schemas.GeofenceEvent, status_code=201)
def create_geofence_event(
    payload: schemas.GeofenceEventCreate, db: Session = Depends(get_db)
):
    if db.get(models.GeofenceTrigger, payload.trigger_id) is None:
        raise HTTPException(status_code=404, detail="Geofence trigger not found")

    event = models.GeofenceEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
