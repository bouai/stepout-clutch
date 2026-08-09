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


def test_patch_single_field(client):
    created = client.post(
        "/checklist-items", json={"label": "Pack umbrella", "category": "weather"}
    ).json()

    response = client.patch(
        f"/checklist-items/{created['id']}", json={"isChecked": True}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["isChecked"] is True
    assert body["label"] == "Pack umbrella"

    get_response = client.get(f"/checklist-items/{created['id']}")
    assert get_response.json()["isChecked"] is True


def test_patch_multi_field(client):
    created = client.post(
        "/checklist-items", json={"label": "Pack umbrella", "category": "weather"}
    ).json()

    response = client.patch(
        f"/checklist-items/{created['id']}",
        json={"label": "Pack raincoat", "category": "routine", "weatherCondition": "rain"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "Pack raincoat"
    assert body["category"] == "routine"
    assert body["weatherCondition"] == "rain"


def test_patch_missing_item_returns_404(client):
    response = client.patch("/checklist-items/999", json={"isChecked": True})
    assert response.status_code == 404


def test_patch_invalid_enum_returns_422(client):
    created = client.post(
        "/checklist-items", json={"label": "Pack umbrella", "category": "weather"}
    ).json()

    response = client.patch(
        f"/checklist-items/{created['id']}", json={"category": "invalid"}
    )
    assert response.status_code == 422


def test_patch_empty_label_returns_422(client):
    created = client.post(
        "/checklist-items", json={"label": "Pack umbrella", "category": "weather"}
    ).json()

    response = client.patch(f"/checklist-items/{created['id']}", json={"label": ""})
    assert response.status_code == 422


def test_patch_empty_body_is_noop(client):
    created = client.post(
        "/checklist-items", json={"label": "Pack umbrella", "category": "weather"}
    ).json()

    response = client.patch(f"/checklist-items/{created['id']}", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "Pack umbrella"
    assert body["category"] == "weather"
    assert body["isChecked"] is False


def test_create_invalid_inventory_item_id_returns_404(client):
    response = client.post(
        "/checklist-items",
        json={"label": "Pack passport", "category": "documents", "inventoryItemId": 9999},
    )
    assert response.status_code == 404


def test_patch_invalid_inventory_item_id_returns_404(client):
    created = client.post(
        "/checklist-items", json={"label": "Pack umbrella", "category": "weather"}
    ).json()

    response = client.patch(
        f"/checklist-items/{created['id']}", json={"inventoryItemId": 9999}
    )
    assert response.status_code == 404


def test_patch_is_checked_cascades_to_linked_inventory_item(client):
    inventory_item = client.post(
        "/inventory-items", json={"name": "Passport", "category": "documents"}
    ).json()
    checklist_item = client.post(
        "/checklist-items",
        json={
            "label": "Pack passport",
            "category": "documents",
            "inventoryItemId": inventory_item["id"],
        },
    ).json()
    assert checklist_item["inventoryItemId"] == inventory_item["id"]

    response = client.patch(
        f"/checklist-items/{checklist_item['id']}", json={"isChecked": True}
    )
    assert response.status_code == 200
    assert response.json()["isChecked"] is True

    linked = client.get(f"/inventory-items/{inventory_item['id']}").json()
    assert linked["isPacked"] is True

    client.patch(f"/checklist-items/{checklist_item['id']}", json={"isChecked": False})
    linked = client.get(f"/inventory-items/{inventory_item['id']}").json()
    assert linked["isPacked"] is False


def test_delete_removes_item(client):
    created = client.post(
        "/checklist-items", json={"label": "Pack umbrella", "category": "weather"}
    ).json()

    delete_response = client.delete(f"/checklist-items/{created['id']}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/checklist-items/{created['id']}")
    assert get_response.status_code == 404

    list_response = client.get("/checklist-items")
    assert list_response.json() == []


def test_delete_missing_returns_404(client):
    response = client.delete("/checklist-items/999")
    assert response.status_code == 404
