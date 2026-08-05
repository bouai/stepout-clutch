def test_list_empty(client):
    response = client.get("/geofence-triggers")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_get(client):
    payload = {
        "label": "Home",
        "latitude": 28.6139,
        "longitude": 77.209,
        "radiusMeters": 100.0,
        "triggerType": "enter",
        "notificationMessage": "You are home",
    }
    create_response = client.post("/geofence-triggers", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["label"] == "Home"
    assert created["isActive"] is True
    assert "id" in created

    get_response = client.get(f"/geofence-triggers/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["triggerType"] == "enter"

    list_response = client.get("/geofence-triggers")
    assert len(list_response.json()) == 1


def test_get_missing_returns_404(client):
    response = client.get("/geofence-triggers/999")
    assert response.status_code == 404


def test_create_invalid_trigger_type_returns_422(client):
    response = client.post(
        "/geofence-triggers",
        json={
            "label": "Home",
            "latitude": 28.6139,
            "longitude": 77.209,
            "radiusMeters": 100.0,
            "triggerType": "hover",
            "notificationMessage": "You are home",
        },
    )
    assert response.status_code == 422
