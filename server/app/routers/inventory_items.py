from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/inventory-items", tags=["inventory-items"])


@router.get("", response_model=list[schemas.InventoryItem])
def list_inventory_items(db: Session = Depends(get_db)):
    return db.query(models.InventoryItem).all()


@router.get("/{item_id}", response_model=schemas.InventoryItem)
def get_inventory_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.InventoryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


@router.post("", response_model=schemas.InventoryItem, status_code=201)
def create_inventory_item(
    payload: schemas.InventoryItemCreate, db: Session = Depends(get_db)
):
    item = models.InventoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=schemas.InventoryItem)
def update_inventory_item(
    item_id: int,
    payload: schemas.InventoryItemUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(models.InventoryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(item, field, value)

    if "is_packed" in updates:
        linked_checklist_items = (
            db.query(models.ChecklistItem)
            .filter(models.ChecklistItem.inventory_item_id == item.id)
            .all()
        )
        for checklist_item in linked_checklist_items:
            checklist_item.is_checked = updates["is_packed"]

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_inventory_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.InventoryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    db.delete(item)
    db.commit()
