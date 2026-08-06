import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChecklistCategory(str, enum.Enum):
    WEATHER = "weather"
    ROUTINE = "routine"
    DOCUMENTS = "documents"
    OTHER = "other"


class InventoryCategory(str, enum.Enum):
    ELECTRONICS = "electronics"
    DOCUMENTS = "documents"
    WEATHER_GEAR = "weather-gear"
    OTHER = "other"


class GeofenceTriggerType(str, enum.Enum):
    ENTER = "enter"
    EXIT = "exit"


class ChecklistWeatherCondition(str, enum.Enum):
    RAIN = "rain"
    SNOW = "snow"
    EXTREME_HEAT = "extreme-heat"
    EXTREME_COLD = "extreme-cold"
    WIND = "wind"
    CLEAR = "clear"


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[ChecklistCategory] = mapped_column(
        Enum(ChecklistCategory), nullable=False
    )
    is_checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_weather_triggered: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    weather_condition: Mapped[ChecklistWeatherCondition | None] = mapped_column(
        Enum(ChecklistWeatherCondition), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    inventory_item_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("inventory_items.id"), nullable=True
    )


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[InventoryCategory] = mapped_column(
        Enum(InventoryCategory), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_packed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class GeofenceTrigger(Base):
    __tablename__ = "geofence_triggers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    radius_meters: Mapped[float] = mapped_column(Float, nullable=False)
    trigger_type: Mapped[GeofenceTriggerType] = mapped_column(
        Enum(GeofenceTriggerType), nullable=False
    )
    notification_message: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
