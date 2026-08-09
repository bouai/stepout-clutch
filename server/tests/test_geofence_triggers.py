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


def test_patch_is_active(client):
    created = client.post(
        "/geofence-triggers",
        json={
            "label": "Home",
            "latitude": 28.6139,
            "longitude": 77.209,
            "radiusMeters": 100.0,
            "triggerType": "enter",
            "notificationMessage": "You are home",
        },
    ).json()

    response = client.patch(
        f"/geofence-triggers/{created['id']}", json={"isActive": False}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["isActive"] is False
    assert body["label"] == "Home"

    get_response = client.get(f"/geofence-triggers/{created['id']}")
    assert get_response.json()["isActive"] is False


def test_patch_missing_returns_404(client):
    response = client.patch("/geofence-triggers/999", json={"isActive": False})
    assert response.status_code == 404


def test_delete_removes_trigger(client):
    created = client.post(
        "/geofence-triggers",
        json={
            "label": "Home",
            "latitude": 28.6139,
            "longitude": 77.209,
            "radiusMeters": 100.0,
            "triggerType": "enter",
            "notificationMessage": "You are home",
        },
    ).json()

    delete_response = client.delete(f"/geofence-triggers/{created['id']}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/geofence-triggers/{created['id']}")
    assert get_response.status_code == 404

    list_response = client.get("/geofence-triggers")
    assert list_response.json() == []


def test_delete_missing_returns_404(client):
    response = client.delete("/geofence-triggers/999")
    assert response.status_code == 404
