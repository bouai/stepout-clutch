"""Place search, proxied to Photon.

Proxied rather than called from the app directly for three reasons: the
upstream host can be swapped without shipping a new build, results are cached
so repeated keystrokes do not hammer a free public service, and the identifying
User-Agent lives in one place.

Photon is OpenStreetMap-backed, needs no API key and has no billing account —
matching the MapLibre/OpenFreeMap choice on the client.
"""

import os
from functools import lru_cache

import httpx
from fastapi import APIRouter, HTTPException, Query

from app import schemas

router = APIRouter(prefix="/places", tags=["places"])

PHOTON_URL = os.getenv("PHOTON_URL", "https://photon.komoot.io/api/")
USER_AGENT = os.getenv("PLACES_USER_AGENT", "StepOut/1.0 (personal trip planner)")
REQUEST_TIMEOUT_SECONDS = 8.0


def _format_label(properties: dict) -> tuple[str, str]:
    """Split a Photon result into a headline name and a locating subtitle."""
    name = properties.get("name") or properties.get("street") or "Unnamed place"

    # Most specific first, de-duplicated, so "Bengaluru, Karnataka, India"
    # doesn't become "Bengaluru, Bengaluru, Karnataka, India".
    parts: list[str] = []
    for key in ("district", "city", "county", "state", "country"):
        value = properties.get(key)
        if value and value != name and value not in parts:
            parts.append(value)

    return name, ", ".join(parts)


@router.get("", response_model=list[schemas.Place])
@router.get("/search", response_model=list[schemas.Place])
def search_places(
    q: str = Query(min_length=2, description="Free-text place query"),
    limit: int = Query(default=8, ge=1, le=20),
    lat: float | None = Query(default=None, description="Bias results near here"),
    lon: float | None = Query(default=None),
):
    results = _search_cached(q.strip(), limit, lat, lon)
    return results


@lru_cache(maxsize=512)
def _search_cached(
    q: str, limit: int, lat: float | None, lon: float | None
) -> tuple[schemas.Place, ...]:
    params: dict[str, str | int | float] = {"q": q, "limit": limit}
    # Biasing by the device's position is what makes a query like "airport"
    # return the nearest one rather than an arbitrary one on another continent.
    if lat is not None and lon is not None:
        params["lat"] = lat
        params["lon"] = lon

    try:
        response = httpx.get(
            PHOTON_URL,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503, detail="Place search is unavailable"
        ) from exc

    places: list[schemas.Place] = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) < 2:
            continue

        properties = feature.get("properties") or {}
        name, context = _format_label(properties)

        places.append(
            schemas.Place(
                name=name,
                context=context,
                # GeoJSON orders coordinates [longitude, latitude].
                longitude=coordinates[0],
                latitude=coordinates[1],
            )
        )

    return tuple(places)
