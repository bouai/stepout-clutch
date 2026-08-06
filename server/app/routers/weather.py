from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query

from app import schemas
from app.models import ChecklistWeatherCondition

router = APIRouter(prefix="/weather", tags=["weather"])

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

SNOW_CODES = {71, 73, 75, 77, 85, 86}
RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}


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


@router.get("", response_model=schemas.Weather)
async def get_weather(lat: float = Query(...), lon: float = Query(...)):
    params = {
        "latitude": lat,
        "longitude": lon,
        "current_weather": "true",
        "temperature_unit": "celsius",
        "windspeed_unit": "kmh",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Failed to fetch weather data")

    current = response.json().get("current_weather")
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
        fetched_at=datetime.now(timezone.utc),
    )
