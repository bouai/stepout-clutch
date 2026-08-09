from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models import (
    ChecklistCategory,
    ChecklistWeatherCondition,
    GeofenceTriggerType,
    InventoryCategory,
)


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
    weather_condition: ChecklistWeatherCondition | None = None
    sort_order: int = 0
    inventory_item_id: int | None = None


class ChecklistItemCreate(ChecklistItemBase):
    pass


class ChecklistItem(ChecklistItemBase):
    id: int
    created_at: datetime


class ChecklistItemUpdate(CamelModel):
    label: str | None = Field(default=None, min_length=1)
    category: ChecklistCategory | None = None
    is_checked: bool | None = None
    is_weather_triggered: bool | None = None
    weather_condition: ChecklistWeatherCondition | None = None
    sort_order: int | None = None
    inventory_item_id: int | None = None


class InventoryItemBase(CamelModel):
    name: str
    category: InventoryCategory
    quantity: int = 1
    is_packed: bool = False


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItem(InventoryItemBase):
    id: int


class InventoryItemUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1)
    category: InventoryCategory | None = None
    quantity: int | None = None
    is_packed: bool | None = None


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


class GeofenceTriggerUpdate(CamelModel):
    label: str | None = Field(default=None, min_length=1)
    latitude: float | None = None
    longitude: float | None = None
    radius_meters: float | None = None
    trigger_type: GeofenceTriggerType | None = None
    notification_message: str | None = None
    is_active: bool | None = None


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


class Weather(CamelModel):
    temperature_celsius: float
    wind_speed_kmh: float
    condition: ChecklistWeatherCondition
    fetched_at: datetime
