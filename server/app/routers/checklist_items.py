from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/checklist-items", tags=["checklist-items"])


@router.get("", response_model=list[schemas.ChecklistItem])
def list_checklist_items(db: Session = Depends(get_db)):
    return db.query(models.ChecklistItem).all()


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

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

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
