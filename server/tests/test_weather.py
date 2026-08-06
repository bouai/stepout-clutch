import httpx
import pytest


def _mock_response(weathercode, temperature, windspeed):
    def handler(request):
        return httpx.Response(
            200,
            json={
                "current_weather": {
                    "temperature": temperature,
                    "windspeed": windspeed,
                    "winddirection": 180,
                    "weathercode": weathercode,
                    "is_day": 1,
                    "time": "2026-08-06T12:00",
                }
            },
        )

    return handler


@pytest.fixture
def mock_open_meteo(monkeypatch):
    def _apply(weathercode, temperature, windspeed):
        transport = httpx.MockTransport(
            _mock_response(weathercode, temperature, windspeed)
        )
        original_init = httpx.AsyncClient.__init__

        def patched_init(self, *args, **kwargs):
            kwargs["transport"] = transport
            original_init(self, *args, **kwargs)

        monkeypatch.setattr(httpx.AsyncClient, "__init__", patched_init)

    return _apply


@pytest.mark.parametrize(
    "weathercode,temperature,windspeed,expected",
    [
        (73, 10.0, 5.0, "snow"),
        (61, 10.0, 5.0, "rain"),
        (1, 36.0, 5.0, "extreme-heat"),
        (1, 2.0, 5.0, "extreme-cold"),
        (1, 20.0, 45.0, "wind"),
        (1, 20.0, 5.0, "clear"),
    ],
)
def test_weather_condition_mapping(
    client, mock_open_meteo, weathercode, temperature, windspeed, expected
):
    mock_open_meteo(weathercode, temperature, windspeed)
    response = client.get("/weather", params={"lat": 28.6139, "lon": 77.2090})
    assert response.status_code == 200
    body = response.json()
    assert body["condition"] == expected
    assert body["temperatureCelsius"] == temperature
    assert body["windSpeedKmh"] == windspeed
    assert "fetchedAt" in body


def test_weather_upstream_failure_returns_502(client, monkeypatch):
    def handler(request):
        raise httpx.ConnectError("connection failed", request=request)

    transport = httpx.MockTransport(handler)
    original_init = httpx.AsyncClient.__init__

    def patched_init(self, *args, **kwargs):
        kwargs["transport"] = transport
        original_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched_init)

    response = client.get("/weather", params={"lat": 28.6139, "lon": 77.2090})
    assert response.status_code == 502
    assert "detail" in response.json()
