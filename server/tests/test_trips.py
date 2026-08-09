def test_list_empty(client):
    response = client.get("/trips")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list(client):
    payload = {"name": "Tokyo", "latitude": 35.6762, "longitude": 139.6503}
    create_response = client.post("/trips", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Tokyo"
    assert created["latitude"] == 35.6762
    assert "id" in created
    assert "createdAt" in created

    list_response = client.get("/trips")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_create_without_coordinates(client):
    response = client.post("/trips", json={"name": "Somewhere TBD"})
    assert response.status_code == 201
    created = response.json()
    assert created["latitude"] is None
    assert created["longitude"] is None


def test_create_missing_name_returns_422(client):
    response = client.post("/trips", json={"latitude": 1.0, "longitude": 2.0})
    assert response.status_code == 422
