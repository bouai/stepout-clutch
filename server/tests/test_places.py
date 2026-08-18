"""Place search, with the upstream geocoder stubbed.

These must never hit the real Photon service — a test suite that depends on a
free public API is both slow and rude.
"""

import httpx
import pytest

from app.routers import places


def photon_feature(
    name="Indiranagar",
    city="Bengaluru",
    state="Karnataka",
    country="India",
    coordinates=(77.6408, 12.9784),
    **extra,
):
    properties = {"name": name, "city": city, "state": state, "country": country}
    properties.update(extra)
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": list(coordinates)},
        "properties": properties,
    }


@pytest.fixture(autouse=True)
def clear_cache():
    places._search_cached.cache_clear()
    yield
    places._search_cached.cache_clear()


@pytest.fixture
def stub_photon(monkeypatch):
    calls: list[dict] = []

    def install(features, status_code=200):
        def fake_get(url, params=None, headers=None, timeout=None):
            calls.append({"url": url, "params": params, "headers": headers})
            request = httpx.Request("GET", url)
            return httpx.Response(
                status_code, json={"features": features}, request=request
            )

        monkeypatch.setattr(places.httpx, "get", fake_get)
        return calls

    return install


def test_returns_name_and_coordinates(client, stub_photon):
    stub_photon([photon_feature()])

    response = client.get("/places?q=indiranagar")
    assert response.status_code == 200

    [place] = response.json()
    assert place["name"] == "Indiranagar"
    assert place["latitude"] == 12.9784
    assert place["longitude"] == 77.6408


def test_builds_a_locating_subtitle_most_specific_first(client, stub_photon):
    stub_photon([photon_feature()])

    [place] = client.get("/places?q=indiranagar").json()
    assert place["context"] == "Bengaluru, Karnataka, India"


def test_subtitle_omits_values_duplicating_the_name(client, stub_photon):
    stub_photon([photon_feature(name="Bengaluru", city="Bengaluru")])

    [place] = client.get("/places?q=bengaluru").json()
    assert place["context"] == "Karnataka, India"


def test_falls_back_to_street_when_a_result_has_no_name(client, stub_photon):
    feature = photon_feature(street="100 Feet Road")
    del feature["properties"]["name"]
    stub_photon([feature])

    [place] = client.get("/places?q=100 feet").json()
    assert place["name"] == "100 Feet Road"


def test_skips_results_without_usable_coordinates(client, stub_photon):
    broken = photon_feature()
    broken["geometry"]["coordinates"] = []
    stub_photon([broken, photon_feature(name="Koramangala")])

    results = client.get("/places?q=bangalore").json()
    assert [p["name"] for p in results] == ["Koramangala"]


def test_passes_location_bias_upstream(client, stub_photon):
    calls = stub_photon([photon_feature()])

    client.get("/places?q=airport&lat=12.97&lon=77.59")

    assert calls[-1]["params"]["lat"] == 12.97
    assert calls[-1]["params"]["lon"] == 77.59


def test_omits_location_bias_when_only_one_coordinate_is_given(client, stub_photon):
    calls = stub_photon([photon_feature()])

    client.get("/places?q=airport&lat=12.97")

    assert "lat" not in calls[-1]["params"]


def test_sends_an_identifying_user_agent(client, stub_photon):
    # Photon is a free public service; anonymous traffic is what gets blocked.
    calls = stub_photon([photon_feature()])

    client.get("/places?q=indiranagar")

    assert "StepOut" in calls[-1]["headers"]["User-Agent"]


def test_caches_repeated_queries(client, stub_photon):
    calls = stub_photon([photon_feature()])

    client.get("/places?q=indiranagar")
    client.get("/places?q=indiranagar")

    assert len(calls) == 1, "typing the same query twice must not re-hit upstream"


def test_rejects_a_query_that_is_too_short(client):
    assert client.get("/places?q=a").status_code == 422


def test_reports_upstream_failure_as_unavailable(client, monkeypatch):
    def boom(*args, **kwargs):
        raise httpx.ConnectError("no route to host")

    monkeypatch.setattr(places.httpx, "get", boom)

    response = client.get("/places?q=indiranagar")
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


def test_honours_the_limit(client, stub_photon):
    calls = stub_photon([photon_feature()])

    client.get("/places?q=indiranagar&limit=3")

    assert calls[-1]["params"]["limit"] == 3


def test_rejects_an_out_of_range_limit(client):
    assert client.get("/places?q=indiranagar&limit=99").status_code == 422


def test_reverse_geocode_names_a_dropped_pin(client, monkeypatch):
    def fake_get(url, params=None, headers=None, timeout=None):
        import httpx as _httpx
        request = _httpx.Request("GET", url)
        return _httpx.Response(
            200,
            json={
                "features": [
                    {
                        "properties": {
                            "name": "Sector 62",
                            "city": "Noida",
                            "state": "Uttar Pradesh",
                            "country": "India",
                        }
                    }
                ]
            },
            request=request,
        )

    from app.routers import places

    places._reverse_cached.cache_clear()
    monkeypatch.setattr(places.httpx, "get", fake_get)

    place = client.get("/places/reverse?lat=28.6&lon=77.4").json()
    assert place["name"] == "Sector 62"
    assert "Noida" in place["context"]
    assert place["latitude"] == 28.6
    assert place["longitude"] == 77.4


def test_reverse_geocode_falls_back_when_nothing_is_mapped(client, monkeypatch):
    def fake_get(url, params=None, headers=None, timeout=None):
        import httpx as _httpx
        request = _httpx.Request("GET", url)
        return _httpx.Response(200, json={"features": []}, request=request)

    from app.routers import places

    places._reverse_cached.cache_clear()
    monkeypatch.setattr(places.httpx, "get", fake_get)

    place = client.get("/places/reverse?lat=0&lon=0").json()
    assert place["name"] == "Dropped pin"
    assert place["latitude"] == 0
