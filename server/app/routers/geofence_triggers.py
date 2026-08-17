from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/geofence-triggers", tags=["geofence-triggers"])


@router.get("", response_model=list[schemas.GeofenceTrigger])
def list_geofence_triggers(
    trip_id: int | None = Query(default=None, alias="tripId"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.GeofenceTrigger).filter(
        models.GeofenceTrigger.user_id == user.id
    )
    if trip_id is not None:
        query = query.filter(models.GeofenceTrigger.trip_id == trip_id)
    return query.all()


@router.get("/{trigger_id}", response_model=schemas.GeofenceTrigger)
def get_geofence_trigger(
    trigger_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    trigger = _owned(db, trigger_id, user)
    if trigger is None:
        raise HTTPException(status_code=404, detail="Geofence trigger not found")
    return trigger


@router.post("", response_model=schemas.GeofenceTrigger, status_code=201)
def create_geofence_trigger(
    payload: schemas.GeofenceTriggerCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    trigger = models.GeofenceTrigger(**payload.model_dump(), user_id=user.id)
    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    return trigger


@router.patch("/{trigger_id}", response_model=schemas.GeofenceTrigger)
def update_geofence_trigger(
    trigger_id: int,
    payload: schemas.GeofenceTriggerUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    trigger = _owned(db, trigger_id, user)
    if trigger is None:
        raise HTTPException(status_code=404, detail="Geofence trigger not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(trigger, field, value)

    db.commit()
    db.refresh(trigger)
    return trigger


@router.delete("/{trigger_id}", status_code=204)
def delete_geofence_trigger(
    trigger_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    trigger = _owned(db, trigger_id, user)
    if trigger is None:
        raise HTTPException(status_code=404, detail="Geofence trigger not found")

    # Events are meaningless without their trigger — leaving them behind made
    # Home's "Latest Alert" card resolve to "Unknown location" forever.
    db.query(models.GeofenceEvent).filter(
        models.GeofenceEvent.trigger_id == trigger_id
    ).delete(synchronize_session=False)

    db.delete(trigger)
    db.commit()


def _owned(
    db: Session, trigger_id: int, user: models.User
) -> models.GeofenceTrigger | None:
    return (
        db.query(models.GeofenceTrigger)
        .filter(
            models.GeofenceTrigger.id == trigger_id,
            models.GeofenceTrigger.user_id == user.id,
        )
        .first()
    )
