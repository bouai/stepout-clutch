def test_list_empty(client):
    response = client.get("/saved-destinations")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_get(client):
    payload = {"label": "India Gate", "latitude": 28.6129, "longitude": 77.2295}
    create_response = client.post("/saved-destinations", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["label"] == "India Gate"
    assert "id" in created

    get_response = client.get(f"/saved-destinations/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["label"] == "India Gate"

    list_response = client.get("/saved-destinations")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_get_missing_returns_404(client):
    response = client.get("/saved-destinations/999")
    assert response.status_code == 404


def test_create_invalid_latitude_type_returns_422(client):
    response = client.post(
        "/saved-destinations",
        json={"label": "Bad", "latitude": "not-a-number", "longitude": 77.2},
    )
    assert response.status_code == 422


def test_create_missing_label_returns_422(client):
    response = client.post(
        "/saved-destinations", json={"latitude": 28.6, "longitude": 77.2}
    )
    assert response.status_code == 422


def test_distance_known_city_pair(client):
    create_response = client.post(
        "/saved-destinations",
        json={"label": "Mumbai", "latitude": 19.0760, "longitude": 72.8777},
    )
    destination_id = create_response.json()["id"]

    response = client.get(
        f"/saved-destinations/{destination_id}/distance",
        params={"lat": 28.6139, "lon": 77.2090},
    )
    assert response.status_code == 200
    body = response.json()
    assert 1130 <= body["distanceKm"] <= 1170
    assert 195 <= body["bearingDegrees"] <= 210


def test_distance_missing_destination_returns_404(client):
    response = client.get(
        "/saved-destinations/999/distance", params={"lat": 28.6139, "lon": 77.2090}
    )
    assert response.status_code == 404


def test_delete_removes_destination(client):
    create_response = client.post(
        "/saved-destinations",
        json={"label": "India Gate", "latitude": 28.6129, "longitude": 77.2295},
    )
    destination_id = create_response.json()["id"]

    delete_response = client.delete(f"/saved-destinations/{destination_id}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/saved-destinations/{destination_id}")
    assert get_response.status_code == 404

    list_response = client.get("/saved-destinations")
    assert list_response.json() == []


def test_delete_missing_returns_404(client):
    response = client.delete("/saved-destinations/999")
    assert response.status_code == 404
