"""Magic-link login, sessions, and per-account data isolation."""

from fastapi.testclient import TestClient

from app.main import app


def unauth() -> TestClient:
    """A client with no Authorization header."""
    return TestClient(app)


def test_request_link_returns_a_dev_token_when_email_is_off(client):
    result = unauth().post("/auth/request-link", json={"email": "a@b.com"}).json()
    assert result["emailEnabled"] is False
    assert result["sent"] is False
    assert result["devToken"]


def test_verify_exchanges_a_token_for_a_session_and_user(client):
    c = unauth()
    token = c.post("/auth/request-link", json={"email": "New@Example.com"}).json()[
        "devToken"
    ]
    session = c.post("/auth/verify", json={"token": token}).json()

    assert session["sessionToken"]
    # Email is normalised to lowercase.
    assert session["user"]["email"] == "new@example.com"


def test_login_creates_the_user_on_first_use(client):
    c = unauth()
    token = c.post("/auth/request-link", json={"email": "fresh@example.com"}).json()[
        "devToken"
    ]
    c.post("/auth/verify", json={"token": token})

    # Logging in again with the same email returns the same account.
    token2 = c.post("/auth/request-link", json={"email": "fresh@example.com"}).json()[
        "devToken"
    ]
    user2 = c.post("/auth/verify", json={"token": token2}).json()["user"]

    first = c.post("/auth/verify", json={"token": token})  # already consumed
    assert first.status_code == 400
    assert user2["email"] == "fresh@example.com"


def test_a_token_cannot_be_used_twice(client):
    c = unauth()
    token = c.post("/auth/request-link", json={"email": "once@example.com"}).json()[
        "devToken"
    ]
    assert c.post("/auth/verify", json={"token": token}).status_code == 200
    assert c.post("/auth/verify", json={"token": token}).status_code == 400


def test_an_unknown_token_is_rejected(client):
    assert unauth().post("/auth/verify", json={"token": "nope"}).status_code == 400


def test_me_returns_the_authenticated_user(client):
    me = client.get("/auth/me").json()
    assert me["email"] == "tester@example.com"


def test_me_without_a_token_is_401(client):
    assert unauth().get("/auth/me").status_code == 401


def test_data_endpoints_require_authentication(client):
    anon = unauth()
    assert anon.get("/trips").status_code == 401
    assert anon.post("/trips", json={"name": "X"}).status_code == 401
    assert anon.get("/checklist-items").status_code == 401


def test_logout_invalidates_the_session(client):
    # `client` carries a valid bearer token.
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_accounts_cannot_see_each_others_trips(client, other_client):
    client.post("/trips", json={"name": "Mine"})
    other_client.post("/trips", json={"name": "Theirs"})

    mine = [t["name"] for t in client.get("/trips").json()]
    theirs = [t["name"] for t in other_client.get("/trips").json()]

    assert mine == ["Mine"]
    assert theirs == ["Theirs"]


def test_one_account_cannot_read_anothers_trip_by_id(client, other_client):
    trip = client.post("/trips", json={"name": "Private"}).json()

    # The other account gets a 404, not the trip — existence is not leaked.
    assert other_client.get(f"/trips/{trip['id']}").status_code == 404


def test_one_account_cannot_delete_anothers_trip(client, other_client):
    trip = client.post("/trips", json={"name": "Private"}).json()

    assert other_client.delete(f"/trips/{trip['id']}").status_code == 404
    assert client.get(f"/trips/{trip['id']}").status_code == 200


def test_one_account_cannot_touch_anothers_checklist_item(client, other_client):
    item = client.post(
        "/checklist-items", json={"label": "Secret", "category": "other"}
    ).json()

    assert (
        other_client.patch(
            f"/checklist-items/{item['id']}", json={"isChecked": True}
        ).status_code
        == 404
    )


def test_reset_only_wipes_the_current_account(client, other_client):
    client.post("/trips", json={"name": "Mine"})
    other_client.post("/trips", json={"name": "Theirs"})

    client.post("/admin/reset?confirm=true")

    assert client.get("/trips").json() == []
    assert [t["name"] for t in other_client.get("/trips").json()] == ["Theirs"]
