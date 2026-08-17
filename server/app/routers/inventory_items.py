from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/inventory-items", tags=["inventory-items"])


@router.get("", response_model=list[schemas.InventoryItem])
def list_inventory_items(
    trip_id: int | None = Query(default=None, alias="tripId"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.InventoryItem).filter(
        models.InventoryItem.user_id == user.id
    )
    if trip_id is not None:
        query = query.filter(models.InventoryItem.trip_id == trip_id)
    return query.all()


@router.get("/{item_id}", response_model=schemas.InventoryItem)
def get_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = _owned(db, item_id, user)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


@router.post("", response_model=schemas.InventoryItem, status_code=201)
def create_inventory_item(
    payload: schemas.InventoryItemCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = models.InventoryItem(**payload.model_dump(), user_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=schemas.InventoryItem)
def update_inventory_item(
    item_id: int,
    payload: schemas.InventoryItemUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = _owned(db, item_id, user)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(item, field, value)

    if "is_packed" in updates:
        linked_checklist_items = (
            db.query(models.ChecklistItem)
            .filter(
                models.ChecklistItem.inventory_item_id == item.id,
                models.ChecklistItem.user_id == user.id,
            )
            .all()
        )
        for checklist_item in linked_checklist_items:
            checklist_item.is_checked = updates["is_packed"]

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = _owned(db, item_id, user)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    db.delete(item)
    db.commit()


def _owned(db: Session, item_id: int, user: models.User) -> models.InventoryItem | None:
    return (
        db.query(models.InventoryItem)
        .filter(
            models.InventoryItem.id == item_id,
            models.InventoryItem.user_id == user.id,
        )
        .first()
    )
