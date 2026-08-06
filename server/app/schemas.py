from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models import ChecklistCategory, GeofenceTriggerType, InventoryCategory


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ChecklistItemBase(CamelModel):
    label: str
    category: ChecklistCategory
    is_checked: bool = False
    is_weather_triggered: bool = False
    sort_order: int = 0
    inventory_item_id: int | None = None


class ChecklistItemCreate(ChecklistItemBase):
    pass


class ChecklistItem(ChecklistItemBase):
    id: int
    created_at: datetime


class InventoryItemBase(CamelModel):
    name: str
    category: InventoryCategory
    quantity: int = 1
    is_packed: bool = False


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItem(InventoryItemBase):
    id: int


class GeofenceTriggerBase(CamelModel):
    label: str
    latitude: float
    longitude: float
    radius_meters: float
    trigger_type: GeofenceTriggerType
    notification_message: str
    is_active: bool = True


class GeofenceTriggerCreate(GeofenceTriggerBase):
    pass


class GeofenceTrigger(GeofenceTriggerBase):
    id: int


class SavedDestinationBase(CamelModel):
    label: str
    latitude: float
    longitude: float


class SavedDestinationCreate(SavedDestinationBase):
    pass


class SavedDestination(SavedDestinationBase):
    id: int


class Distance(CamelModel):
    distance_km: float
    bearing_degrees: int
