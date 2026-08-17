"""Smart trip setup: applying a type's template to a new trip."""

import pytest

from app.models import ChecklistWeatherCondition
from app.routers import trips as trips_router
from app import templates


@pytest.fixture
def stub_weather(monkeypatch):
    """Pins the weather condition the template engine sees, avoiding the network."""

    def install(condition):
        async def fake(_lat, _lon):
            return condition

        monkeypatch.setattr(trips_router, "fetch_condition", fake)

    return install


def make_trip(client, trip_type="commute", located=True):
    payload = {"name": "Infosys Noida", "tripType": trip_type}
    if located:
        payload["latitude"] = 28.459
        payload["longitude"] = 77.519
    response = client.post("/trips", json=payload)
    assert response.status_code == 201
    return response.json()


def test_trip_stores_its_type(client):
    trip = make_trip(client)
    assert trip["tripType"] == "commute"
    assert trip["templateApplied"] is False


def test_apply_populates_checklist_and_packing(client, stub_weather):
    stub_weather(ChecklistWeatherCondition.CLEAR)
    trip = make_trip(client)

    result = client.post(f"/trips/{trip['id']}/apply-template")
    assert result.status_code == 200

    commute = templates.TEMPLATES[templates.TripType.COMMUTE]
    checklist = client.get(f"/checklist-items?tripId={trip['id']}").json()
    inventory = client.get(f"/inventory-items?tripId={trip['id']}").json()

    # Clear weather adds no extra items, so counts match the template exactly.
    assert len(checklist) == len(commute.checklist)
    assert len(inventory) == len(commute.inventory)
    assert "Laptop" in [item["name"] for item in inventory]


def test_apply_creates_an_arrival_zone_for_a_located_trip(client, stub_weather):
    stub_weather(ChecklistWeatherCondition.CLEAR)
    trip = make_trip(client)

    result = client.post(f"/trips/{trip['id']}/apply-template").json()
    assert result["zonesAdded"] == 1

    zones = client.get(f"/geofence-triggers?tripId={trip['id']}").json()
    assert len(zones) == 1
    assert zones[0]["label"] == "Infosys Noida"
    assert zones[0]["triggerType"] == "enter"
    assert zones[0]["notificationMessage"] == "Arrived at Infosys Noida"


def test_rain_adds_an_umbrella(client, stub_weather):
    stub_weather(ChecklistWeatherCondition.RAIN)
    trip = make_trip(client)

    result = client.post(f"/trips/{trip['id']}/apply-template").json()
    assert result["weatherCondition"] == "rain"

    inventory = [i["name"] for i in client.get(f"/inventory-items?tripId={trip['id']}").json()]
    assert "Umbrella" in inventory

    checklist = client.get(f"/checklist-items?tripId={trip['id']}").json()
    umbrella = next(i for i in checklist if "umbrella" in i["label"].lower())
    assert umbrella["isWeatherTriggered"] is True
    assert umbrella["weatherCondition"] == "rain"


def test_clear_weather_adds_no_extra_items(client, stub_weather):
    stub_weather(ChecklistWeatherCondition.CLEAR)
    trip = make_trip(client)

    result = client.post(f"/trips/{trip['id']}/apply-template").json()

    commute = templates.TEMPLATES[templates.TripType.COMMUTE]
    assert result["checklistAdded"] == len(commute.checklist)
    assert result["weatherCondition"] == "clear"


def test_unlocated_trip_gets_items_but_no_zone_or_weather(client):
    trip = make_trip(client, located=False)

    result = client.post(f"/trips/{trip['id']}/apply-template").json()

    assert result["zonesAdded"] == 0
    assert result["weatherCondition"] is None
    assert client.get(f"/geofence-triggers?tripId={trip['id']}").json() == []
    # The checklist/packing still populate — those don't need a location.
    assert result["checklistAdded"] > 0


def test_apply_marks_the_trip_and_refuses_a_second_run(client, stub_weather):
    stub_weather(ChecklistWeatherCondition.CLEAR)
    trip = make_trip(client)

    assert client.post(f"/trips/{trip['id']}/apply-template").status_code == 200
    assert client.get(f"/trips/{trip['id']}").json()["templateApplied"] is True

    second = client.post(f"/trips/{trip['id']}/apply-template")
    assert second.status_code == 409

    # The refusal must not have doubled anything.
    commute = templates.TEMPLATES[templates.TripType.COMMUTE]
    checklist = client.get(f"/checklist-items?tripId={trip['id']}").json()
    assert len(checklist) == len(commute.checklist)


def test_apply_to_a_typeless_trip_is_rejected(client):
    trip = client.post("/trips", json={"name": "Untyped"}).json()
    assert client.post(f"/trips/{trip['id']}/apply-template").status_code == 400


def test_apply_to_a_missing_trip_is_404(client):
    assert client.post("/trips/999/apply-template").status_code == 404


@pytest.mark.parametrize("trip_type", [t.value for t in templates.TripType])
def test_every_trip_type_has_a_usable_template(client, stub_weather, trip_type):
    stub_weather(ChecklistWeatherCondition.CLEAR)
    trip = make_trip(client, trip_type=trip_type)

    result = client.post(f"/trips/{trip['id']}/apply-template").json()

    # Every type must give the user something, or the picker offers a dead end.
    assert result["checklistAdded"] > 0
    assert result["inventoryAdded"] > 0


def test_weather_failure_still_applies_the_base_template(client, stub_weather):
    # fetch_condition returns None when Open-Meteo is unreachable.
    stub_weather(None)
    trip = make_trip(client)

    result = client.post(f"/trips/{trip['id']}/apply-template").json()

    assert result["weatherCondition"] is None
    commute = templates.TEMPLATES[templates.TripType.COMMUTE]
    assert result["checklistAdded"] == len(commute.checklist)
    # A located trip still gets its arrival zone even when weather is down.
    assert result["zonesAdded"] == 1
