import time


def _create_trigger(client):
    response = client.post(
        "/geofence-triggers",
        json={
            "label": "Home",
            "latitude": 28.6139,
            "longitude": 77.209,
            "radiusMeters": 100.0,
            "triggerType": "enter",
            "notificationMessage": "You are home",
        },
    )
    return response.json()


def test_list_empty(client):
    response = client.get("/geofence-events")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_get(client):
    trigger = _create_trigger(client)

    response = client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
    )
    assert response.status_code == 201
    created = response.json()
    assert created["triggerId"] == trigger["id"]
    assert created["direction"] == "enter"
    assert "id" in created
    assert "firedAt" in created

    list_response = client.get("/geofence-events")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_create_missing_trigger_returns_404(client):
    response = client.post(
        "/geofence-events", json={"triggerId": 999, "direction": "enter"}
    )
    assert response.status_code == 404


def test_create_invalid_direction_returns_422(client):
    trigger = _create_trigger(client)

    response = client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "hover"}
    )
    assert response.status_code == 422


def test_list_orders_latest_first(client):
    trigger = _create_trigger(client)

    first = client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
    ).json()
    time.sleep(0.01)
    second = client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "exit"}
    ).json()
    time.sleep(0.01)
    third = client.post(
        "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
    ).json()

    response = client.get("/geofence-events")
    assert response.status_code == 200
    ids = [event["id"] for event in response.json()]
    assert ids == [third["id"], second["id"], first["id"]]


def test_list_respects_limit(client):
    trigger = _create_trigger(client)

    for _ in range(3):
        client.post(
            "/geofence-events", json={"triggerId": trigger["id"], "direction": "enter"}
        )
        time.sleep(0.01)

    response = client.get("/geofence-events", params={"limit": 1})
    assert response.status_code == 200
    assert len(response.json()) == 1
