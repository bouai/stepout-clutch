import pytest
from pydantic import ValidationError

from app.schemas import ChecklistItemCreate, GeofenceTriggerCreate, InventoryItemCreate


def test_checklist_item_create_valid():
    item = ChecklistItemCreate.model_validate(
        {
            "label": "Pack umbrella",
            "category": "weather",
            "isChecked": False,
            "isWeatherTriggered": True,
            "sortOrder": 1,
        }
    )
    assert item.label == "Pack umbrella"
    assert item.is_weather_triggered is True
    assert item.inventory_item_id is None


def test_checklist_item_create_invalid_category():
    with pytest.raises(ValidationError):
        ChecklistItemCreate.model_validate(
            {"label": "Pack umbrella", "category": "not-a-category"}
        )


def test_checklist_item_create_missing_label():
    with pytest.raises(ValidationError):
        ChecklistItemCreate.model_validate({"category": "weather"})


def test_inventory_item_create_valid():
    item = InventoryItemCreate.model_validate(
        {"name": "Laptop", "category": "electronics", "quantity": 1, "isPacked": False}
    )
    assert item.name == "Laptop"
    assert item.category == "electronics"


def test_inventory_item_create_invalid_quantity_type():
    with pytest.raises(ValidationError):
        InventoryItemCreate.model_validate(
            {"name": "Laptop", "category": "electronics", "quantity": "many"}
        )


def test_geofence_trigger_create_valid():
    trigger = GeofenceTriggerCreate.model_validate(
        {
            "label": "Home",
            "latitude": 28.6139,
            "longitude": 77.209,
            "radiusMeters": 100.0,
            "triggerType": "enter",
            "notificationMessage": "You are home",
        }
    )
    assert trigger.trigger_type == "enter"
    assert trigger.is_active is True


def test_geofence_trigger_create_invalid_trigger_type():
    with pytest.raises(ValidationError):
        GeofenceTriggerCreate.model_validate(
            {
                "label": "Home",
                "latitude": 28.6139,
                "longitude": 77.209,
                "radiusMeters": 100.0,
                "triggerType": "hover",
                "notificationMessage": "You are home",
            }
        )


def test_geofence_trigger_create_missing_required_field():
    with pytest.raises(ValidationError):
        GeofenceTriggerCreate.model_validate(
            {"label": "Home", "latitude": 28.6139, "longitude": 77.209}
        )
