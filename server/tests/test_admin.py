"""The reset endpoint, which the in-app 'start fresh' action calls."""


def populate(client) -> int:
    """Creates one row in every table and returns the trip id."""
    trip = client.post("/trips", json={"name": "Tokyo"}).json()
    client.post(
        "/checklist-items",
        json={"label": "Passport", "category": "documents", "tripId": trip["id"]},
    )
    client.post(
        "/inventory-items",
        json={"name": "Laptop", "category": "electronics", "tripId": trip["id"]},
    )
    client.post(
        "/saved-destinations",
        json={
            "label": "Hotel",
            "latitude": 35.6,
            "longitude": 139.7,
            "tripId": trip["id"],
        },
    )
    trigger = client.post(
        "/geofence-triggers",
        json={
            "label": "Shinjuku",
            "latitude": 35.69,
            "longitude": 139.70,
            "radiusMeters": 300,
            "triggerType": "enter",
            "notificationMessage": "Arrived",
            "tripId": trip["id"],
        },
    ).json()
    client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
    )
    return trip["id"]


EMPTIED_PATHS = (
    "/trips",
    "/checklist-items",
    "/inventory-items",
    "/saved-destinations",
    "/geofence-triggers",
    "/geofence-events",
)


def test_reset_clears_every_table(client):
    populate(client)
    for path in EMPTIED_PATHS:
        assert client.get(path).json(), f"{path} should be populated before reset"

    response = client.post("/admin/reset?confirm=true")
    assert response.status_code == 200

    for path in EMPTIED_PATHS:
        assert client.get(path).json() == [], f"{path} should be empty after reset"


def test_reset_reports_what_it_deleted(client):
    populate(client)

    body = client.post("/admin/reset?confirm=true").json()

    assert body["confirmed"] is True
    assert body["deleted"]["trips"] == 1
    assert body["deleted"]["checklist_items"] == 1
    assert body["deleted"]["geofence_events"] == 1


def test_reset_without_confirmation_deletes_nothing(client):
    populate(client)

    body = client.post("/admin/reset").json()

    assert body["confirmed"] is False
    assert body["deleted"] == {}
    assert len(client.get("/trips").json()) == 1


def test_reset_is_safe_to_run_on_an_empty_database(client):
    body = client.post("/admin/reset?confirm=true").json()

    assert body["confirmed"] is True
    assert all(count == 0 for count in body["deleted"].values())


def test_reset_is_idempotent(client):
    populate(client)

    client.post("/admin/reset?confirm=true")
    second = client.post("/admin/reset?confirm=true").json()

    assert all(count == 0 for count in second["deleted"].values())


def test_new_data_can_be_created_after_a_reset(client):
    populate(client)
    client.post("/admin/reset?confirm=true")

    created = client.post("/trips", json={"name": "Goa"})
    assert created.status_code == 201
    assert [t["name"] for t in client.get("/trips").json()] == ["Goa"]
