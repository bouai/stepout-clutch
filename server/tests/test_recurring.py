"""Recurring trips and the daily checklist reset."""


def make_trip(client, recurring=True):
    response = client.post(
        "/trips", json={"name": "Infosys Noida", "isRecurring": recurring}
    )
    assert response.status_code == 201
    return response.json()


def add_checked_item(client, trip_id, label="Grab badge"):
    item = client.post(
        "/checklist-items",
        json={"label": label, "category": "routine", "tripId": trip_id, "isChecked": True},
    )
    assert item.status_code == 201
    return item.json()


def test_trip_stores_recurring_flag(client):
    trip = make_trip(client)
    assert trip["isRecurring"] is True
    assert trip["checklistResetOn"] is None


def test_reset_unchecks_all_items_and_records_the_date(client):
    trip = make_trip(client)
    add_checked_item(client, trip["id"], "Badge")
    add_checked_item(client, trip["id"], "Laptop")

    result = client.post(f"/trips/{trip['id']}/reset-checklist?date=2026-08-18")
    assert result.status_code == 200
    assert result.json() == {"resetCount": 2, "checklistResetOn": "2026-08-18"}

    items = client.get(f"/checklist-items?tripId={trip['id']}").json()
    assert all(item["isChecked"] is False for item in items)


def test_reset_records_the_date_on_the_trip(client):
    trip = make_trip(client)
    add_checked_item(client, trip["id"])

    client.post(f"/trips/{trip['id']}/reset-checklist?date=2026-08-18")

    assert client.get(f"/trips/{trip['id']}").json()["checklistResetOn"] == "2026-08-18"


def test_reset_only_touches_the_named_trip(client):
    commute = make_trip(client)
    other = client.post("/trips", json={"name": "Weekend"}).json()
    add_checked_item(client, commute["id"], "Badge")
    kept = add_checked_item(client, other["id"], "Sunscreen")

    client.post(f"/trips/{commute['id']}/reset-checklist?date=2026-08-18")

    other_items = client.get(f"/checklist-items?tripId={other['id']}").json()
    assert other_items[0]["isChecked"] is True
    assert other_items[0]["id"] == kept["id"]


def test_reset_reports_zero_when_nothing_was_checked(client):
    trip = make_trip(client)
    client.post(
        "/checklist-items",
        json={"label": "Unchecked", "category": "routine", "tripId": trip["id"]},
    )

    result = client.post(f"/trips/{trip['id']}/reset-checklist?date=2026-08-18").json()
    assert result["resetCount"] == 0


def test_reset_requires_a_date(client):
    trip = make_trip(client)
    assert client.post(f"/trips/{trip['id']}/reset-checklist").status_code == 422


def test_reset_on_a_missing_trip_is_404(client):
    assert client.post("/trips/999/reset-checklist?date=2026-08-18").status_code == 404


def test_recurring_flag_can_be_toggled(client):
    trip = make_trip(client, recurring=False)
    assert trip["isRecurring"] is False

    updated = client.patch(f"/trips/{trip['id']}", json={"isRecurring": True})
    assert updated.status_code == 200
    assert updated.json()["isRecurring"] is True
