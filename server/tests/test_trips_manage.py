"""Rename/delete for trips, and the detach-don't-orphan rule on delete."""

import pytest


def make_trip(client, name="Tokyo"):
    response = client.post("/trips", json={"name": name})
    assert response.status_code == 201
    return response.json()


def test_get_trip(client):
    trip = make_trip(client)
    response = client.get(f"/trips/{trip['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "Tokyo"


def test_get_missing_trip_returns_404(client):
    assert client.get("/trips/999").status_code == 404


def test_patch_renames_trip(client):
    trip = make_trip(client)
    response = client.patch(f"/trips/{trip['id']}", json={"name": "Kyoto"})
    assert response.status_code == 200
    assert response.json()["name"] == "Kyoto"
    assert client.get("/trips").json()[0]["name"] == "Kyoto"


def test_patch_accepts_partial_update(client):
    trip = make_trip(client)
    response = client.patch(
        f"/trips/{trip['id']}", json={"latitude": 35.68, "longitude": 139.69}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Tokyo"
    assert body["latitude"] == 35.68


def test_patch_rejects_empty_name(client):
    trip = make_trip(client)
    assert client.patch(f"/trips/{trip['id']}", json={"name": ""}).status_code == 422


def test_patch_missing_trip_returns_404(client):
    assert client.patch("/trips/999", json={"name": "Nope"}).status_code == 404


def test_delete_removes_trip(client):
    trip = make_trip(client)
    assert client.delete(f"/trips/{trip['id']}").status_code == 204
    assert client.get("/trips").json() == []


def test_delete_missing_trip_returns_404(client):
    assert client.delete("/trips/999").status_code == 404


@pytest.mark.parametrize(
    "path,payload,list_path",
    [
        (
            "/checklist-items",
            {"label": "Passport", "category": "documents"},
            "/checklist-items",
        ),
        (
            "/inventory-items",
            {"name": "Laptop", "category": "electronics"},
            "/inventory-items",
        ),
        (
            "/saved-destinations",
            {"label": "Hotel", "latitude": 35.6, "longitude": 139.7},
            "/saved-destinations",
        ),
        (
            "/geofence-triggers",
            {
                "label": "Shinjuku",
                "latitude": 35.69,
                "longitude": 139.70,
                "radiusMeters": 300,
                "triggerType": "enter",
                "notificationMessage": "Arrived",
            },
            "/geofence-triggers",
        ),
    ],
)
def test_delete_trip_detaches_scoped_rows_instead_of_deleting_them(
    client, path, payload, list_path
):
    trip = make_trip(client)
    created = client.post(path, json={**payload, "tripId": trip["id"]})
    assert created.status_code == 201
    assert created.json()["tripId"] == trip["id"]

    assert client.delete(f"/trips/{trip['id']}").status_code == 204

    rows = client.get(list_path).json()
    assert len(rows) == 1, "row must survive its trip being deleted"
    assert rows[0]["tripId"] is None, "row must fall back to the unscoped view"


def test_delete_trip_detaches_geofence_events(client):
    trip = make_trip(client)
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

    assert client.delete(f"/trips/{trip['id']}").status_code == 204

    events = client.get("/geofence-events").json()
    assert len(events) == 1
    assert events[0]["tripId"] is None


def test_delete_trip_leaves_other_trips_rows_alone(client):
    kept = make_trip(client, "Lisbon")
    doomed = make_trip(client, "Tokyo")

    client.post(
        "/checklist-items",
        json={"label": "Passport", "category": "documents", "tripId": kept["id"]},
    )
    client.post(
        "/checklist-items",
        json={"label": "Umbrella", "category": "weather", "tripId": doomed["id"]},
    )

    client.delete(f"/trips/{doomed['id']}")

    still_scoped = client.get(f"/checklist-items?tripId={kept['id']}").json()
    assert len(still_scoped) == 1
    assert still_scoped[0]["label"] == "Passport"


def test_trip_stores_and_returns_a_location_name(client):
    created = client.post(
        "/trips",
        json={
            "name": "Work",
            "latitude": 28.46,
            "longitude": 77.52,
            "locationName": "Infosys Noida, Sector 62",
        },
    )
    assert created.status_code == 201
    assert created.json()["locationName"] == "Infosys Noida, Sector 62"

    trip_id = created.json()["id"]
    assert client.get(f"/trips/{trip_id}").json()["locationName"] == "Infosys Noida, Sector 62"


def test_location_name_can_be_updated(client):
    trip = client.post("/trips", json={"name": "Work"}).json()
    updated = client.patch(
        f"/trips/{trip['id']}",
        json={"latitude": 28.46, "longitude": 77.52, "locationName": "Cyber Hub"},
    )
    assert updated.status_code == 200
    assert updated.json()["locationName"] == "Cyber Hub"
