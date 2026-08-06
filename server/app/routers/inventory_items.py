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

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item
