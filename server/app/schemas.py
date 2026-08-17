from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer
from pydantic.alias_generators import to_camel

from app.models import (
    ChecklistCategory,
    ChecklistWeatherCondition,
    GeofenceTriggerType,
    InventoryCategory,
    TripType,
)


def serialize_utc(value: datetime) -> str:
    """Render a datetime as an explicitly-UTC ISO 8601 string.

    Values read back from SQLite are naive even though they were stored as UTC,
    and an offset-less string is parsed as *local* time by JS `new Date()` —
    which silently skewed every relative timestamp in the app by the device's
    UTC offset. Naive values are therefore assumed UTC and stamped as such.
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


UtcDateTime = Annotated[datetime, PlainSerializer(serialize_utc, return_type=str)]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class TripBase(CamelModel):
    name: str
    latitude: float | None = None
    longitude: float | None = None
    trip_type: TripType | None = None
    is_recurring: bool = False


class TripCreate(TripBase):
    pass


class Trip(TripBase):
    id: int
    template_applied: bool = False
    checklist_reset_on: str | None = None
    created_at: UtcDateTime


class TripUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1)
    latitude: float | None = None
    longitude: float | None = None
    trip_type: TripType | None = None
    is_recurring: bool | None = None


class ChecklistReset(CamelModel):
    """Result of resetting a recurring trip's checklist for a new day."""

    reset_count: int
    checklist_reset_on: str


class TemplateApplied(CamelModel):
    """Summary of what applying a template created, shown to the user."""

    checklist_added: int
    inventory_added: int
    zones_added: int
    weather_condition: ChecklistWeatherCondition | None = None


class ChecklistItemBase(CamelModel):
    label: str
    category: ChecklistCategory
    is_checked: bool = False
    is_weather_triggered: bool = False
    weather_condition: ChecklistWeatherCondition | None = None
    sort_order: int = 0
    inventory_item_id: int | None = None
    trip_id: int | None = None


class ChecklistItemCreate(ChecklistItemBase):
    pass


class ChecklistItem(ChecklistItemBase):
    id: int
    created_at: UtcDateTime


class ChecklistItemUpdate(CamelModel):
    label: str | None = Field(default=None, min_length=1)
    category: ChecklistCategory | None = None
    is_checked: bool | None = None
    is_weather_triggered: bool | None = None
    weather_condition: ChecklistWeatherCondition | None = None
    sort_order: int | None = None
    inventory_item_id: int | None = None
    trip_id: int | None = None


class InventoryItemBase(CamelModel):
    name: str
    category: InventoryCategory
    quantity: int = 1
    is_packed: bool = False
    trip_id: int | None = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItem(InventoryItemBase):
    id: int


class InventoryItemUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1)
    category: InventoryCategory | None = None
    quantity: int | None = None
    is_packed: bool | None = None
    trip_id: int | None = None


class GeofenceTriggerBase(CamelModel):
    label: str
    latitude: float
    longitude: float
    radius_meters: float
    trigger_type: GeofenceTriggerType
    notification_message: str
    is_active: bool = True
    trip_id: int | None = None


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
    trip_id: int | None = None


class SavedDestinationBase(CamelModel):
    label: str
    latitude: float
    longitude: float
    trip_id: int | None = None


class SavedDestinationCreate(SavedDestinationBase):
    pass


class SavedDestination(SavedDestinationBase):
    id: int


class GeofenceEventBase(CamelModel):
    trigger_id: int
    direction: GeofenceTriggerType


class GeofenceEventCreate(GeofenceEventBase):
    pass


class GeofenceEvent(GeofenceEventBase):
    id: int
    fired_at: UtcDateTime
    trip_id: int | None = None


class Distance(CamelModel):
    distance_km: float
    bearing_degrees: int


class Place(CamelModel):
    """A geocoded search result, ready to become a destination or trip."""

    name: str
    context: str
    latitude: float
    longitude: float


class Weather(CamelModel):
    temperature_celsius: float
    wind_speed_kmh: float
    condition: ChecklistWeatherCondition
    # Optional: the daily forecast block is a nicety for Home's weather card,
    # and its absence must not fail the request.
    high_celsius: float | None = None
    low_celsius: float | None = None
    fetched_at: UtcDateTime
