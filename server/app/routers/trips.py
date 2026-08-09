from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("", response_model=list[schemas.Trip])
def list_trips(db: Session = Depends(get_db)):
    return db.query(models.Trip).all()


@router.post("", response_model=schemas.Trip, status_code=201)
def create_trip(payload: schemas.TripCreate, db: Session = Depends(get_db)):
    trip = models.Trip(**payload.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip
