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


def test_patch_single_field(client):
    created = client.post(
        "/inventory-items", json={"name": "Laptop", "category": "electronics"}
    ).json()

    response = client.patch(
        f"/inventory-items/{created['id']}", json={"isPacked": True}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["isPacked"] is True
    assert body["name"] == "Laptop"

    get_response = client.get(f"/inventory-items/{created['id']}")
    assert get_response.json()["isPacked"] is True


def test_patch_multi_field(client):
    created = client.post(
        "/inventory-items", json={"name": "Laptop", "category": "electronics"}
    ).json()

    response = client.patch(
        f"/inventory-items/{created['id']}",
        json={"name": "Umbrella", "category": "weather-gear", "quantity": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Umbrella"
    assert body["category"] == "weather-gear"
    assert body["quantity"] == 2


def test_patch_missing_item_returns_404(client):
    response = client.patch("/inventory-items/999", json={"isPacked": True})
    assert response.status_code == 404


def test_patch_invalid_category_returns_422(client):
    created = client.post(
        "/inventory-items", json={"name": "Laptop", "category": "electronics"}
    ).json()

    response = client.patch(
        f"/inventory-items/{created['id']}", json={"category": "invalid"}
    )
    assert response.status_code == 422


def test_patch_invalid_quantity_type_returns_422(client):
    created = client.post(
        "/inventory-items", json={"name": "Laptop", "category": "electronics"}
    ).json()

    response = client.patch(
        f"/inventory-items/{created['id']}", json={"quantity": "many"}
    )
    assert response.status_code == 422


def test_patch_empty_name_returns_422(client):
    created = client.post(
        "/inventory-items", json={"name": "Laptop", "category": "electronics"}
    ).json()

    response = client.patch(f"/inventory-items/{created['id']}", json={"name": ""})
    assert response.status_code == 422


def test_patch_empty_body_is_noop(client):
    created = client.post(
        "/inventory-items", json={"name": "Laptop", "category": "electronics"}
    ).json()

    response = client.patch(f"/inventory-items/{created['id']}", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Laptop"
    assert body["category"] == "electronics"
    assert body["isPacked"] is False


def test_patch_is_packed_cascades_to_linked_checklist_items(client):
    inventory_item = client.post(
        "/inventory-items", json={"name": "Passport", "category": "documents"}
    ).json()
    checklist_item_a = client.post(
        "/checklist-items",
        json={
            "label": "Pack passport A",
            "category": "documents",
            "inventoryItemId": inventory_item["id"],
        },
    ).json()
    checklist_item_b = client.post(
        "/checklist-items",
        json={
            "label": "Pack passport B",
            "category": "documents",
            "inventoryItemId": inventory_item["id"],
        },
    ).json()
    unrelated_item = client.post(
        "/checklist-items", json={"label": "Unrelated", "category": "other"}
    ).json()

    response = client.patch(
        f"/inventory-items/{inventory_item['id']}", json={"isPacked": True}
    )
    assert response.status_code == 200
    assert response.json()["isPacked"] is True

    assert (
        client.get(f"/checklist-items/{checklist_item_a['id']}").json()["isChecked"]
        is True
    )
    assert (
        client.get(f"/checklist-items/{checklist_item_b['id']}").json()["isChecked"]
        is True
    )
    assert (
        client.get(f"/checklist-items/{unrelated_item['id']}").json()["isChecked"]
        is False
    )


def test_delete_removes_item(client):
    created = client.post(
        "/inventory-items", json={"name": "Laptop", "category": "electronics"}
    ).json()

    delete_response = client.delete(f"/inventory-items/{created['id']}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/inventory-items/{created['id']}")
    assert get_response.status_code == 404

    list_response = client.get("/inventory-items")
    assert list_response.json() == []


def test_delete_missing_returns_404(client):
    response = client.delete("/inventory-items/999")
    assert response.status_code == 404
