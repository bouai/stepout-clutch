def test_list_empty(client):
    response = client.get("/checklist-items")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_get(client):
    payload = {
        "label": "Pack umbrella",
        "category": "weather",
        "isWeatherTriggered": True,
        "sortOrder": 2,
    }
    create_response = client.post("/checklist-items", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["label"] == "Pack umbrella"
    assert created["isChecked"] is False
    assert "id" in created
    assert "createdAt" in created

    get_response = client.get(f"/checklist-items/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == created["id"]

    list_response = client.get("/checklist-items")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_get_missing_returns_404(client):
    response = client.get("/checklist-items/999")
    assert response.status_code == 404


def test_create_invalid_category_returns_422(client):
    response = client.post(
        "/checklist-items", json={"label": "Bad", "category": "invalid"}
    )
    assert response.status_code == 422


def test_create_and_get_with_weather_condition(client):
    payload = {
        "label": "Pack umbrella",
        "category": "weather",
        "isWeatherTriggered": True,
        "weatherCondition": "rain",
        "sortOrder": 2,
    }
    create_response = client.post("/checklist-items", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["weatherCondition"] == "rain"

    get_response = client.get(f"/checklist-items/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["weatherCondition"] == "rain"

    list_response = client.get("/checklist-items")
    assert list_response.status_code == 200
    assert list_response.json()[0]["weatherCondition"] == "rain"


def test_create_invalid_weather_condition_returns_422(client):
    response = client.post(
        "/checklist-items",
        json={
            "label": "Bad",
            "category": "weather",
            "weatherCondition": "hurricane",
        },
    )
    assert response.status_code == 422
