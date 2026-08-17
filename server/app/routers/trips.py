from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas, templates
from app.database import get_db
from app.routers.weather import fetch_condition

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


@router.post("/{trip_id}/apply-template", response_model=schemas.TemplateApplied)
async def apply_template(trip_id: int, db: Session = Depends(get_db)):
    """Populate an empty trip from its type's template.

    Creates the template's checklist and packing items, layers on
    weather-driven items when the trip has a location, and drops an arrival
    geofence at that location. Refuses to run twice so it can't silently double
    every item.
    """
    trip = db.get(models.Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.trip_type is None:
        raise HTTPException(status_code=400, detail="Trip has no type to template")
    if trip.template_applied:
        raise HTTPException(status_code=409, detail="Template already applied")

    template = templates.TEMPLATES[trip.trip_type]

    for order, seed in enumerate(template.checklist):
        db.add(
            models.ChecklistItem(
                label=seed.label,
                category=seed.category,
                sort_order=order,
                trip_id=trip.id,
            )
        )
    for seed in template.inventory:
        db.add(
            models.InventoryItem(
                name=seed.name,
                category=seed.category,
                quantity=seed.quantity,
                trip_id=trip.id,
            )
        )

    checklist_added = len(template.checklist)
    inventory_added = len(template.inventory)

    # Weather extras and the arrival zone only make sense for a located trip.
    condition = None
    zones_added = 0
    if trip.latitude is not None and trip.longitude is not None:
        condition = await fetch_condition(trip.latitude, trip.longitude)
        addition = templates.WEATHER_ADDITIONS.get(condition) if condition else None
        if addition is not None:
            db.add(
                models.ChecklistItem(
                    label=addition.checklist.label,
                    category=addition.checklist.category,
                    is_weather_triggered=True,
                    weather_condition=condition,
                    sort_order=checklist_added,
                    trip_id=trip.id,
                )
            )
            db.add(
                models.InventoryItem(
                    name=addition.inventory.name,
                    category=addition.inventory.category,
                    trip_id=trip.id,
                )
            )
            checklist_added += 1
            inventory_added += 1

        db.add(
            models.GeofenceTrigger(
                label=trip.name,
                latitude=trip.latitude,
                longitude=trip.longitude,
                radius_meters=templates.ARRIVAL_RADIUS_METERS,
                trigger_type=models.GeofenceTriggerType.ENTER,
                notification_message=f"Arrived at {trip.name}",
                trip_id=trip.id,
            )
        )
        zones_added = 1

    trip.template_applied = True
    db.commit()

    return schemas.TemplateApplied(
        checklist_added=checklist_added,
        inventory_added=inventory_added,
        zones_added=zones_added,
        weather_condition=condition,
    )


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
