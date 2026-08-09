from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/checklist-items", tags=["checklist-items"])


@router.get("", response_model=list[schemas.ChecklistItem])
def list_checklist_items(
    trip_id: int | None = Query(default=None, alias="tripId"),
    db: Session = Depends(get_db),
):
    query = db.query(models.ChecklistItem)
    if trip_id is not None:
        query = query.filter(models.ChecklistItem.trip_id == trip_id)
    return query.all()


@router.get("/{item_id}", response_model=schemas.ChecklistItem)
def get_checklist_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.ChecklistItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return item


@router.post("", response_model=schemas.ChecklistItem, status_code=201)
def create_checklist_item(
    payload: schemas.ChecklistItemCreate, db: Session = Depends(get_db)
):
    if payload.inventory_item_id is not None:
        if db.get(models.InventoryItem, payload.inventory_item_id) is None:
            raise HTTPException(status_code=404, detail="Inventory item not found")

    item = models.ChecklistItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=schemas.ChecklistItem)
def update_checklist_item(
    item_id: int,
    payload: schemas.ChecklistItemUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(models.ChecklistItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    updates = payload.model_dump(exclude_unset=True)

    if updates.get("inventory_item_id") is not None:
        if db.get(models.InventoryItem, updates["inventory_item_id"]) is None:
            raise HTTPException(status_code=404, detail="Inventory item not found")

    for field, value in updates.items():
        setattr(item, field, value)

    if "is_checked" in updates and item.inventory_item_id is not None:
        linked_item = db.get(models.InventoryItem, item.inventory_item_id)
        if linked_item is not None:
            linked_item.is_packed = updates["is_checked"]

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_checklist_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.ChecklistItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    db.delete(item)
    db.commit()
