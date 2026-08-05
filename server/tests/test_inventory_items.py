def test_list_empty(client):
    response = client.get("/inventory-items")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_get(client):
    payload = {"name": "Laptop", "category": "electronics", "quantity": 1}
    create_response = client.post("/inventory-items", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Laptop"
    assert created["isPacked"] is False
    assert "id" in created

    get_response = client.get(f"/inventory-items/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Laptop"

    list_response = client.get("/inventory-items")
    assert len(list_response.json()) == 1


def test_get_missing_returns_404(client):
    response = client.get("/inventory-items/999")
    assert response.status_code == 404


def test_create_invalid_quantity_returns_422(client):
    response = client.post(
        "/inventory-items",
        json={"name": "Laptop", "category": "electronics", "quantity": "many"},
    )
    assert response.status_code == 422
