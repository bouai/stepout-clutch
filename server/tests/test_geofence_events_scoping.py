"""Events inherit their trigger's trip, and are filterable by it.

Home shows every other card scoped to the selected trip; the Latest Alert card
must not be the one place that leaks another trip's data.
"""


def make_trigger(client, label="Shinjuku", trip_id=None):
    payload = {
        "label": label,
        "latitude": 35.69,
        "longitude": 139.70,
        "radiusMeters": 300,
        "triggerType": "enter",
        "notificationMessage": "Arrived",
    }
    if trip_id is not None:
        payload["tripId"] = trip_id
    response = client.post("/geofence-triggers", json=payload)
    assert response.status_code == 201
    return response.json()


def test_event_inherits_trip_from_trigger(client):
    trip = client.post("/trips", json={"name": "Tokyo"}).json()
    trigger = make_trigger(client, trip_id=trip["id"])

    event = client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
    )
    assert event.status_code == 201
    assert event.json()["tripId"] == trip["id"]


def test_event_from_unscoped_trigger_has_no_trip(client):
    trigger = make_trigger(client)
    event = client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
    )
    assert event.json()["tripId"] is None


def test_client_cannot_override_inherited_trip(client):
    trip = client.post("/trips", json={"name": "Tokyo"}).json()
    other = client.post("/trips", json={"name": "Lisbon"}).json()
    trigger = make_trigger(client, trip_id=trip["id"])

    event = client.post(
        "/geofence-events",
        json={
            "triggerId": trigger["id"],
            "direction": "enter",
            "tripId": other["id"],
        },
    )
    assert event.json()["tripId"] == trip["id"], "trigger's trip must win"


def test_list_filters_by_trip(client):
    tokyo = client.post("/trips", json={"name": "Tokyo"}).json()
    lisbon = client.post("/trips", json={"name": "Lisbon"}).json()

    tokyo_trigger = make_trigger(client, "Shinjuku", tokyo["id"])
    lisbon_trigger = make_trigger(client, "Alfama", lisbon["id"])

    client.post(
        "/geofence-events", json={"triggerId": tokyo_trigger["id"], "direction": "enter"}
    )
    client.post(
        "/geofence-events",
        json={"triggerId": lisbon_trigger["id"], "direction": "exit"},
    )

    tokyo_events = client.get(f"/geofence-events?tripId={tokyo['id']}").json()
    assert len(tokyo_events) == 1
    assert tokyo_events[0]["triggerId"] == tokyo_trigger["id"]

    assert len(client.get("/geofence-events").json()) == 2, "unfiltered shows both"


def test_trip_filter_combines_with_limit(client):
    trip = client.post("/trips", json={"name": "Tokyo"}).json()
    trigger = make_trigger(client, trip_id=trip["id"])
    for _ in range(3):
        client.post(
            "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
        )

    events = client.get(f"/geofence-events?tripId={trip['id']}&limit=1").json()
    assert len(events) == 1


def test_deleting_trigger_removes_its_events(client):
    trigger = make_trigger(client)
    client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
    )
    assert len(client.get("/geofence-events").json()) == 1

    assert client.delete(f"/geofence-triggers/{trigger['id']}").status_code == 204
    assert client.get("/geofence-events").json() == [], (
        "orphaned events made Home resolve 'Unknown location' forever"
    )
