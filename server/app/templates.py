"""Starter content for each kind of trip.

Applying a template turns a freshly-created, empty trip into a useful one —
a sensible checklist and packing list, plus an arrival zone — so the user
never faces a blank slate. Weather-driven items are layered on top when the
trip has a location.

Kept as plain data rather than rows so the sets are obvious, reviewable, and
easy to tune without a migration.
"""

from dataclasses import dataclass, field

from app.models import (
    ChecklistCategory,
    ChecklistWeatherCondition,
    InventoryCategory,
    TripType,
)


@dataclass(frozen=True)
class ChecklistSeed:
    label: str
    category: ChecklistCategory


@dataclass(frozen=True)
class InventorySeed:
    name: str
    category: InventoryCategory
    quantity: int = 1


@dataclass(frozen=True)
class TripTemplate:
    checklist: list[ChecklistSeed] = field(default_factory=list)
    inventory: list[InventorySeed] = field(default_factory=list)


CL = ChecklistCategory
INV = InventoryCategory

TEMPLATES: dict[TripType, TripTemplate] = {
    TripType.COMMUTE: TripTemplate(
        checklist=[
            ChecklistSeed("Grab office badge", CL.DOCUMENTS),
            ChecklistSeed("Charge laptop overnight", CL.ROUTINE),
            ChecklistSeed("Check first meeting time", CL.ROUTINE),
        ],
        inventory=[
            InventorySeed("Laptop", INV.ELECTRONICS),
            InventorySeed("Laptop charger", INV.ELECTRONICS),
            InventorySeed("Office badge", INV.DOCUMENTS),
            InventorySeed("Water bottle", INV.OTHER),
            InventorySeed("Headphones", INV.ELECTRONICS),
        ],
    ),
    TripType.DAY_TRIP: TripTemplate(
        checklist=[
            ChecklistSeed("Check the day's weather", CL.WEATHER),
            ChecklistSeed("Charge phone", CL.ROUTINE),
            ChecklistSeed("Plan the route", CL.ROUTINE),
        ],
        inventory=[
            InventorySeed("Phone charger", INV.ELECTRONICS),
            InventorySeed("Power bank", INV.ELECTRONICS),
            InventorySeed("Water bottle", INV.OTHER),
            InventorySeed("Sunglasses", INV.OTHER),
            InventorySeed("Wallet", INV.DOCUMENTS),
            InventorySeed("Snacks", INV.OTHER),
        ],
    ),
    TripType.OVERNIGHT: TripTemplate(
        checklist=[
            ChecklistSeed("Confirm accommodation", CL.DOCUMENTS),
            ChecklistSeed("Set out-of-office", CL.ROUTINE),
            ChecklistSeed("Pack toiletries", CL.ROUTINE),
        ],
        inventory=[
            InventorySeed("Change of clothes", INV.OTHER),
            InventorySeed("Toiletries kit", INV.OTHER),
            InventorySeed("Toothbrush", INV.OTHER),
            InventorySeed("Phone charger", INV.ELECTRONICS),
            InventorySeed("Sleepwear", INV.OTHER),
        ],
    ),
    TripType.BUSINESS: TripTemplate(
        checklist=[
            ChecklistSeed("Print or save tickets", CL.DOCUMENTS),
            ChecklistSeed("Confirm hotel booking", CL.DOCUMENTS),
            ChecklistSeed("Set out-of-office", CL.ROUTINE),
            ChecklistSeed("Charge all devices", CL.ROUTINE),
        ],
        inventory=[
            InventorySeed("Laptop", INV.ELECTRONICS),
            InventorySeed("Laptop charger", INV.ELECTRONICS),
            InventorySeed("Business attire", INV.OTHER),
            InventorySeed("ID / passport", INV.DOCUMENTS),
            InventorySeed("Toiletries kit", INV.OTHER),
            InventorySeed("Power bank", INV.ELECTRONICS),
        ],
    ),
    TripType.FLIGHT: TripTemplate(
        checklist=[
            ChecklistSeed("Complete web check-in", CL.DOCUMENTS),
            ChecklistSeed("Charge all devices", CL.ROUTINE),
            ChecklistSeed("Leave for the airport early", CL.ROUTINE),
        ],
        inventory=[
            InventorySeed("Passport / ID", INV.DOCUMENTS),
            InventorySeed("Boarding pass", INV.DOCUMENTS),
            InventorySeed("Phone charger", INV.ELECTRONICS),
            InventorySeed("Power bank", INV.ELECTRONICS),
            InventorySeed("Neck pillow", INV.OTHER),
            InventorySeed("Headphones", INV.ELECTRONICS),
        ],
    ),
    TripType.OTHER: TripTemplate(
        checklist=[
            ChecklistSeed("Check the weather", CL.WEATHER),
            ChecklistSeed("Charge phone", CL.ROUTINE),
        ],
        inventory=[
            InventorySeed("Phone charger", INV.ELECTRONICS),
            InventorySeed("Wallet", INV.DOCUMENTS),
            InventorySeed("Water bottle", INV.OTHER),
        ],
    ),
}


@dataclass(frozen=True)
class WeatherSeed:
    checklist: ChecklistSeed
    inventory: InventorySeed


# Extra items layered on when the destination's forecast warrants them. The
# checklist item is tagged with the condition so the app can badge it "Today".
WEATHER_ADDITIONS: dict[ChecklistWeatherCondition, WeatherSeed] = {
    ChecklistWeatherCondition.RAIN: WeatherSeed(
        ChecklistSeed("Pack an umbrella — rain expected", CL.WEATHER),
        InventorySeed("Umbrella", INV.WEATHER_GEAR),
    ),
    ChecklistWeatherCondition.SNOW: WeatherSeed(
        ChecklistSeed("Dress for snow", CL.WEATHER),
        InventorySeed("Warm jacket", INV.WEATHER_GEAR),
    ),
    ChecklistWeatherCondition.EXTREME_HEAT: WeatherSeed(
        ChecklistSeed("Carry extra water — hot day", CL.WEATHER),
        InventorySeed("Sunscreen", INV.WEATHER_GEAR),
    ),
    ChecklistWeatherCondition.EXTREME_COLD: WeatherSeed(
        ChecklistSeed("Bundle up — very cold", CL.WEATHER),
        InventorySeed("Warm layers", INV.WEATHER_GEAR),
    ),
    ChecklistWeatherCondition.WIND: WeatherSeed(
        ChecklistSeed("Windy — bring a windbreaker", CL.WEATHER),
        InventorySeed("Windbreaker", INV.WEATHER_GEAR),
    ),
}

# Arrival geofence created for a located trip.
ARRIVAL_RADIUS_METERS = 300.0
