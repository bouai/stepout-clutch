"""Seed the local dev database with a realistic two-trip dataset.

Run from `server/`:  python seed_demo.py [--reset]

`--reset` drops and recreates every table first. Use it after a schema change,
since `Base.metadata.create_all` only creates missing *tables* — it will not
add a new column to a table that already exists.
"""

import argparse
from datetime import datetime, timedelta, timezone

from app.database import Base, SessionLocal, engine
from app import models


def seed(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(models.Trip).count() > 0 and not reset:
            print("Database already has trips; pass --reset to rebuild it.")
            return

        tokyo = models.Trip(name="Tokyo", latitude=35.6762, longitude=139.6503)
        lisbon = models.Trip(name="Lisbon", latitude=38.7223, longitude=-9.1393)
        db.add_all([tokyo, lisbon])
        db.flush()

        # Enough rows that the lists overflow one screenful — the condition
        # that made the missing scroll containers invisible in testing.
        inventory = [
            models.InventoryItem(
                name=name, category=category, quantity=qty, is_packed=packed,
                trip_id=tokyo.id,
            )
            for name, category, qty, packed in [
                ("Laptop", models.InventoryCategory.ELECTRONICS, 1, True),
                ("Laptop charger", models.InventoryCategory.ELECTRONICS, 1, True),
                ("Power adapter (Type A)", models.InventoryCategory.ELECTRONICS, 2, False),
                ("Passport", models.InventoryCategory.DOCUMENTS, 1, True),
                ("JR Pass voucher", models.InventoryCategory.DOCUMENTS, 1, False),
                ("Travel insurance", models.InventoryCategory.DOCUMENTS, 1, True),
                ("Rain jacket", models.InventoryCategory.WEATHER_GEAR, 1, False),
                ("Folding umbrella", models.InventoryCategory.WEATHER_GEAR, 1, False),
                ("Walking shoes", models.InventoryCategory.OTHER, 1, True),
                ("Noise-cancelling headphones", models.InventoryCategory.ELECTRONICS, 1, False),
                ("Portable battery", models.InventoryCategory.ELECTRONICS, 2, False),
                ("Toiletries kit", models.InventoryCategory.OTHER, 1, False),
            ]
        ]
        db.add_all(inventory)
        db.flush()

        checklist = [
            models.ChecklistItem(
                label=label, category=category, is_checked=checked,
                is_weather_triggered=weather, weather_condition=condition,
                sort_order=i, trip_id=tokyo.id,
                inventory_item_id=inventory[link].id if link is not None else None,
            )
            for i, (label, category, checked, weather, condition, link) in enumerate([
                ("Check passport expiry", models.ChecklistCategory.DOCUMENTS, True, False, None, 3),
                ("Print JR Pass voucher", models.ChecklistCategory.DOCUMENTS, False, False, None, 4),
                ("Notify bank of travel", models.ChecklistCategory.ROUTINE, True, False, None, None),
                ("Download offline maps", models.ChecklistCategory.ROUTINE, False, False, None, None),
                ("Pack rain jacket", models.ChecklistCategory.WEATHER, False, True,
                 models.ChecklistWeatherCondition.RAIN, 6),
                ("Pack umbrella", models.ChecklistCategory.WEATHER, False, True,
                 models.ChecklistWeatherCondition.RAIN, 7),
                ("Charge power bank", models.ChecklistCategory.ROUTINE, False, False, None, 10),
                ("Set out-of-office", models.ChecklistCategory.ROUTINE, True, False, None, None),
                ("Book airport transfer", models.ChecklistCategory.OTHER, False, False, None, None),
                ("Confirm hotel check-in time", models.ChecklistCategory.OTHER, False, False, None, None),
            ])
        ]
        db.add_all(checklist)

        destinations = [
            models.SavedDestination(label=label, latitude=lat, longitude=lon, trip_id=tokyo.id)
            for label, lat, lon in [
                ("Tsukiji Outer Market", 35.6654, 139.7707),
                ("Shibuya Crossing", 35.6595, 139.7005),
                ("Senso-ji Temple", 35.7148, 139.7967),
                ("teamLab Planets", 35.6487, 139.7900),
                ("Shinjuku Gyoen", 35.6852, 139.7100),
            ]
        ]
        db.add_all(destinations)

        triggers = [
            models.GeofenceTrigger(
                label=label, latitude=lat, longitude=lon, radius_meters=radius,
                trigger_type=kind, notification_message=message,
                is_active=active, trip_id=tokyo.id,
            )
            for label, lat, lon, radius, kind, message, active in [
                ("Shinjuku Ward", 35.6938, 139.7034, 800,
                 models.GeofenceTriggerType.ENTER, "You've arrived in Shinjuku", True),
                ("Hotel", 35.6895, 139.6917, 200,
                 models.GeofenceTriggerType.EXIT, "Heading out — got your umbrella?", True),
                ("Haneda Airport", 35.5494, 139.7798, 1500,
                 models.GeofenceTriggerType.ENTER, "At the airport", True),
                ("Tsukiji Market", 35.6654, 139.7707, 300,
                 models.GeofenceTriggerType.ENTER, "Tsukiji — try the tamagoyaki", False),
            ]
        ]
        db.add_all(triggers)
        db.flush()

        now = datetime.now(timezone.utc)
        db.add_all([
            models.GeofenceEvent(
                trigger_id=triggers[0].id,
                direction=models.GeofenceTriggerType.ENTER,
                fired_at=now - timedelta(minutes=12),
                trip_id=tokyo.id,
            ),
            models.GeofenceEvent(
                trigger_id=triggers[1].id,
                direction=models.GeofenceTriggerType.EXIT,
                fired_at=now - timedelta(hours=3),
                trip_id=tokyo.id,
            ),
        ])

        # Lisbon stays sparse on purpose: switching to it should visibly empty
        # the dashboard, which is how trip scoping gets verified by eye.
        db.add(models.ChecklistItem(
            label="Renew EU adapter", category=models.ChecklistCategory.OTHER,
            sort_order=0, trip_id=lisbon.id,
        ))
        db.add(models.SavedDestination(
            label="Belém Tower", latitude=38.6916, longitude=-9.2160, trip_id=lisbon.id,
        ))

        # One unscoped row, to prove the "All" view is not just a union of trips.
        db.add(models.InventoryItem(
            name="Reusable water bottle", category=models.InventoryCategory.OTHER,
            quantity=1, is_packed=False, trip_id=None,
        ))

        db.commit()

        print("Seeded:")
        for model, label in [
            (models.Trip, "trips"),
            (models.ChecklistItem, "checklist items"),
            (models.InventoryItem, "inventory items"),
            (models.SavedDestination, "saved destinations"),
            (models.GeofenceTrigger, "geofence triggers"),
            (models.GeofenceEvent, "geofence events"),
        ]:
            print(f"  {db.query(model).count():>3}  {label}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="drop and recreate all tables")
    seed(**vars(parser.parse_args()))
