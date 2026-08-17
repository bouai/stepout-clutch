"""Destructive maintenance operations, kept apart from the CRUD routers."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/admin", tags=["admin"])

# Children before parents: trips are referenced by everything else, and events
# are referenced by nothing.
DELETION_ORDER = (
    models.GeofenceEvent,
    models.GeofenceTrigger,
    models.ChecklistItem,
    models.InventoryItem,
    models.SavedDestination,
    models.Trip,
)


@router.post("/reset", status_code=200)
def reset_all_data(
    confirm: bool = Query(
        default=False,
        description="Must be true. Guards against a stray POST wiping everything.",
    ),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Deletes the current account's data. Used by the in-app 'start fresh'."""
    if not confirm:
        return {"deleted": {}, "confirmed": False}

    deleted: dict[str, int] = {}
    for model in DELETION_ORDER:
        deleted[model.__tablename__] = (
            db.query(model)
            .filter(model.user_id == user.id)
            .delete(synchronize_session=False)
        )

    db.commit()
    return {"deleted": deleted, "confirmed": True}
