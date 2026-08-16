from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/trips", tags=["trips"])

# Every table that carries an optional trip scope. Deleting a trip detaches
# these rows rather than deleting them — trip scoping is an additive filter,
# so the underlying items must survive their trip.
SCOPED_MODELS = (
    models.ChecklistItem,
    models.InventoryItem,
    models.SavedDestination,
    models.GeofenceTrigger,
    models.GeofenceEvent,
)


@router.get("", response_model=list[schemas.Trip])
def list_trips(db: Session = Depends(get_db)):
    return db.query(models.Trip).all()


@router.get("/{trip_id}", response_model=schemas.Trip)
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.get(models.Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.post("", response_model=schemas.Trip, status_code=201)
def create_trip(payload: schemas.TripCreate, db: Session = Depends(get_db)):
    trip = models.Trip(**payload.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{trip_id}", response_model=schemas.Trip)
def update_trip(
    trip_id: int, payload: schemas.TripUpdate, db: Session = Depends(get_db)
):
    trip = db.get(models.Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(trip, field, value)

    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=204)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.get(models.Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Detach before deleting so scoped rows fall back to the unscoped ("All")
    # view instead of pointing at a trip that no longer exists.
    for model in SCOPED_MODELS:
        db.query(model).filter(model.trip_id == trip_id).update(
            {model.trip_id: None}, synchronize_session=False
        )

    db.delete(trip)
    db.commit()
