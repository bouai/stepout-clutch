from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query

from app import schemas
from app.models import ChecklistWeatherCondition

router = APIRouter(prefix="/weather", tags=["weather"])

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

SNOW_CODES = {71, 73, 75, 77, 85, 86}
RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}

OPEN_METEO_PARAMS = {
    "current_weather": "true",
    "daily": "temperature_2m_max,temperature_2m_min",
    "forecast_days": 1,
    "timezone": "auto",
    "temperature_unit": "celsius",
    "windspeed_unit": "kmh",
}


def _map_condition(
    weathercode: int, temperature_celsius: float, wind_speed_kmh: float
) -> ChecklistWeatherCondition:
    if weathercode in SNOW_CODES:
        return ChecklistWeatherCondition.SNOW
    if weathercode in RAIN_CODES:
        return ChecklistWeatherCondition.RAIN
    if temperature_celsius > 35:
        return ChecklistWeatherCondition.EXTREME_HEAT
    if temperature_celsius < 5:
        return ChecklistWeatherCondition.EXTREME_COLD
    if wind_speed_kmh > 40:
        return ChecklistWeatherCondition.WIND
    return ChecklistWeatherCondition.CLEAR


async def fetch_condition(lat: float, lon: float) -> ChecklistWeatherCondition | None:
    """Just the condition for a location, or None if the forecast is unreachable.

    Used by the trip-template engine to decide weather-driven items. Returns
    None rather than raising, because failing to reach Open-Meteo must not fail
    trip setup — the user still gets their template, just without the extras.
    """
    params = {"latitude": lat, "longitude": lon, **OPEN_METEO_PARAMS}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
        current = response.json().get("current_weather")
        if current is None:
            return None
    except httpx.HTTPError:
        return None
    return _map_condition(
        current["weathercode"], current["temperature"], current["windspeed"]
    )


def _today_extreme(payload: dict, key: str) -> float | None:
    """Today's high/low, or None when the daily block is absent or malformed.

    Treated as optional throughout: the daily forecast is a nicety for the
    Home weather card, and losing it must never fail the whole request.
    """
    daily = payload.get("daily")
    if not isinstance(daily, dict):
        return None
    values = daily.get(key)
    if not isinstance(values, list) or not values:
        return None
    value = values[0]
    return value if isinstance(value, (int, float)) else None


@router.get("", response_model=schemas.Weather)
async def get_weather(lat: float = Query(...), lon: float = Query(...)):
    params = {
        "latitude": lat,
        "longitude": lon,
        "current_weather": "true",
        "daily": "temperature_2m_max,temperature_2m_min",
        "forecast_days": 1,
        "timezone": "auto",
        "temperature_unit": "celsius",
        "windspeed_unit": "kmh",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Failed to fetch weather data")

    payload = response.json()
    current = payload.get("current_weather")
    if current is None:
        raise HTTPException(status_code=502, detail="Failed to fetch weather data")

    temperature_celsius = current["temperature"]
    wind_speed_kmh = current["windspeed"]
    condition = _map_condition(
        current["weathercode"], temperature_celsius, wind_speed_kmh
    )

    return schemas.Weather(
        temperature_celsius=temperature_celsius,
        wind_speed_kmh=wind_speed_kmh,
        condition=condition,
        high_celsius=_today_extreme(payload, "temperature_2m_max"),
        low_celsius=_today_extreme(payload, "temperature_2m_min"),
        fetched_at=datetime.now(timezone.utc),
    )
