"""Every datetime the API emits must carry an explicit UTC designator.

A naive ISO 8601 string (no `Z`, no offset) is parsed by JavaScript's
`new Date()` as *local* time. Because the values are stored as UTC, an
offset-less response silently skews every client-side relative timestamp by
the device's UTC offset — which is what broke Home's "Latest Alert" card.
"""

from datetime import datetime, timedelta, timezone

from app.schemas import serialize_utc

# Any timestamp the client will parse with `new Date()`.
TIMESTAMP_FIELDS = {
    "createdAt",
    "firedAt",
    "fetchedAt",
}


def assert_utc_designated(payload: dict) -> None:
    """Fail if any known timestamp field lacks an explicit UTC designator."""
    for field in TIMESTAMP_FIELDS & payload.keys():
        value = payload[field]
        assert value.endswith("Z"), (
            f"{field}={value!r} has no UTC designator; JS would parse it as local time"
        )
        # Round-trips through the same parser a JS client would agree with.
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        assert parsed.tzinfo is not None
        assert abs(datetime.now(timezone.utc) - parsed) < timedelta(minutes=5), (
            f"{field}={value!r} is not close to now; UTC conversion is likely wrong"
        )


def test_serialize_utc_stamps_naive_datetime_as_utc():
    naive = datetime(2026, 8, 16, 7, 16, 11, 544436)
    assert serialize_utc(naive) == "2026-08-16T07:16:11.544436Z"


def test_serialize_utc_preserves_already_aware_datetime():
    aware = datetime(2026, 8, 16, 7, 16, 11, tzinfo=timezone.utc)
    assert serialize_utc(aware) == "2026-08-16T07:16:11Z"


def test_serialize_utc_converts_non_utc_offset_to_utc():
    ist = datetime(2026, 8, 16, 12, 46, 11, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    assert serialize_utc(ist) == "2026-08-16T07:16:11Z"


def test_trip_created_at_is_utc_designated(client):
    response = client.post("/trips", json={"name": "Tokyo"})
    assert response.status_code == 201
    assert_utc_designated(response.json())


def test_checklist_item_created_at_is_utc_designated(client):
    response = client.post(
        "/checklist-items", json={"label": "Passport", "category": "documents"}
    )
    assert response.status_code == 201
    assert_utc_designated(response.json())


def test_geofence_event_fired_at_is_utc_designated(client):
    trigger = client.post(
        "/geofence-triggers",
        json={
            "label": "Shinjuku",
            "latitude": 35.69,
            "longitude": 139.70,
            "radiusMeters": 300,
            "triggerType": "enter",
            "notificationMessage": "Arrived",
        },
    )
    assert trigger.status_code == 201

    response = client.post(
        "/geofence-events",
        json={"triggerId": trigger.json()["id"], "direction": "enter"},
    )
    assert response.status_code == 201
    assert_utc_designated(response.json())


def test_list_endpoints_keep_utc_designator(client):
    client.post("/trips", json={"name": "Lisbon"})
    client.post("/checklist-items", json={"label": "Charger", "category": "other"})

    for path in ("/trips", "/checklist-items"):
        for row in client.get(path).json():
            assert_utc_designated(row)
