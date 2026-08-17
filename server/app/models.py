import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class LoginToken(Base):
    """A short-lived magic-link token, exchanged for a session."""

    __tablename__ = "login_tokens"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Session(Base):
    """A long-lived session token sent as a bearer credential."""

    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


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


class TripType(str, enum.Enum):
    COMMUTE = "commute"
    DAY_TRIP = "day-trip"
    OVERNIGHT = "overnight"
    BUSINESS = "business"
    FLIGHT = "flight"
    OTHER = "other"


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Human-readable name for the coordinates (from place search), so the UI can
    # show "Infosys Noida" instead of "28.459, 77.519".
    location_name: Mapped[str | None] = mapped_column(String, nullable=True)
    trip_type: Mapped[TripType | None] = mapped_column(Enum(TripType), nullable=True)
    # Set once a template has been applied, so re-applying can be refused rather
    # than silently doubling every item.
    template_applied: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    # A recurring trip (a commute) starts each day fresh: its checklist is
    # unchecked when a new local day is first seen.
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # The local date (YYYY-MM-DD) the checklist was last reset for. Stored as a
    # plain string because the "day" that matters is the device's, not UTC's.
    checklist_reset_on: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
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
    trip_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("trips.id"), nullable=True
    )


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[InventoryCategory] = mapped_column(
        Enum(InventoryCategory), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_packed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trip_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("trips.id"), nullable=True
    )


class GeofenceTrigger(Base):
    __tablename__ = "geofence_triggers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    radius_meters: Mapped[float] = mapped_column(Float, nullable=False)
    trigger_type: Mapped[GeofenceTriggerType] = mapped_column(
        Enum(GeofenceTriggerType), nullable=False
    )
    notification_message: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    trip_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("trips.id"), nullable=True
    )


class SavedDestination(Base):
    __tablename__ = "saved_destinations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    trip_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("trips.id"), nullable=True
    )


class GeofenceEvent(Base):
    __tablename__ = "geofence_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    trigger_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("geofence_triggers.id"), nullable=False
    )
    direction: Mapped[GeofenceTriggerType] = mapped_column(
        Enum(GeofenceTriggerType), nullable=False
    )
    fired_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    trip_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("trips.id"), nullable=True
    )
