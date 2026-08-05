from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/geofence-triggers", tags=["geofence-triggers"])


@router.get("", response_model=list[schemas.GeofenceTrigger])
def list_geofence_triggers(db: Session = Depends(get_db)):
    return db.query(models.GeofenceTrigger).all()


@router.get("/{trigger_id}", response_model=schemas.GeofenceTrigger)
def get_geofence_trigger(trigger_id: int, db: Session = Depends(get_db)):
    trigger = db.get(models.GeofenceTrigger, trigger_id)
    if trigger is None:
        raise HTTPException(status_code=404, detail="Geofence trigger not found")
    return trigger


@router.post("", response_model=schemas.GeofenceTrigger, status_code=201)
def create_geofence_trigger(
    payload: schemas.GeofenceTriggerCreate, db: Session = Depends(get_db)
):
    trigger = models.GeofenceTrigger(**payload.model_dump())
    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    return trigger
