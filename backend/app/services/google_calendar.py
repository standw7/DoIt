"""Google Calendar API wrapper."""

import asyncio
from datetime import datetime, timezone

import httpx

BASE_URL = "https://www.googleapis.com/calendar/v3"
CALENDAR_LIST_URL = f"{BASE_URL}/users/me/calendarList"


async def _headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}


# ── Calendar management ─────────────────────────────────────────


async def find_or_create_doit_calendar(access_token: str) -> str:
    """Find existing 'DoIt' calendar or create one. Returns calendar ID."""
    headers = await _headers(access_token)

    async with httpx.AsyncClient() as client:
        # List calendars
        resp = await client.get(CALENDAR_LIST_URL, headers=headers)
        resp.raise_for_status()
        calendars = resp.json().get("items", [])

        for cal in calendars:
            if cal.get("summary") == "DoIt":
                return cal["id"]

        # Create new calendar
        resp = await client.post(
            f"{BASE_URL}/calendars",
            headers=headers,
            json={"summary": "DoIt", "description": "Tasks scheduled by DoIt"},
        )
        resp.raise_for_status()
        return resp.json()["id"]


# ── Events ──────────────────────────────────────────────────────


async def get_visible_calendars(access_token: str) -> list[dict]:
    """List visible calendars with their colors.

    Returns list of {"id": str, "color": str} for calendars marked
    as visible (selected) in the user's Google Calendar UI.
    """
    headers = await _headers(access_token)

    async with httpx.AsyncClient() as client:
        resp = await client.get(CALENDAR_LIST_URL, headers=headers)
        resp.raise_for_status()
        calendars = resp.json().get("items", [])
        return [
            {"id": cal["id"], "color": cal.get("backgroundColor", "")}
            for cal in calendars
            if cal.get("selected", False)
        ]


async def list_events(
    access_token: str,
    calendar_id: str,
    time_min: str,
    time_max: str,
    calendar_color: str = "",
) -> list[dict]:
    """Fetch events from a single calendar within a time range.

    time_min/time_max are date strings like "2026-02-19".
    calendar_color is the hex background color of the parent calendar.
    Returns simplified event dicts.
    """
    headers = await _headers(access_token)

    # Build RFC3339 timestamps
    t_min = f"{time_min}T00:00:00Z"
    t_max = f"{time_max}T23:59:59Z"

    params = {
        "timeMin": t_min,
        "timeMax": t_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": "250",
    }

    events: list[dict] = []
    page_token = None

    async with httpx.AsyncClient() as client:
        while True:
            if page_token:
                params["pageToken"] = page_token

            resp = await client.get(
                f"{BASE_URL}/calendars/{calendar_id}/events",
                headers=headers,
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("items", []):
                events.append(_normalize_event(item, calendar_color))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    return events


async def list_all_events(
    access_token: str,
    time_min: str,
    time_max: str,
) -> list[dict]:
    """Fetch events from all visible user calendars in parallel."""
    calendars = await get_visible_calendars(access_token)

    async def _fetch_one(cal: dict) -> list[dict]:
        try:
            return await list_events(
                access_token, cal["id"], time_min, time_max, cal["color"]
            )
        except Exception:
            return []

    results = await asyncio.gather(*[_fetch_one(cal) for cal in calendars])

    all_events: list[dict] = []
    for batch in results:
        all_events.extend(batch)

    # Deduplicate by event ID (same event can appear in multiple calendars)
    seen: set[str] = set()
    unique: list[dict] = []
    for event in all_events:
        if event["id"] not in seen:
            seen.add(event["id"])
            unique.append(event)

    return unique


async def create_event(
    access_token: str,
    calendar_id: str,
    summary: str,
    start_datetime: str,
    end_datetime: str,
    description: str | None = None,
) -> str:
    """Create a calendar event. Returns the event ID."""
    headers = await _headers(access_token)

    body: dict = {
        "summary": summary,
        "start": {"dateTime": start_datetime},
        "end": {"dateTime": end_datetime},
    }
    if description:
        body["description"] = description

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/calendars/{calendar_id}/events",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        return resp.json()["id"]


async def update_event(
    access_token: str,
    calendar_id: str,
    event_id: str,
    start_datetime: str | None = None,
    end_datetime: str | None = None,
) -> None:
    """Update (PATCH) a calendar event's start/end times."""
    headers = await _headers(access_token)

    body: dict = {}
    if start_datetime:
        body["start"] = {"dateTime": start_datetime}
    if end_datetime:
        body["end"] = {"dateTime": end_datetime}

    if not body:
        return

    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{BASE_URL}/calendars/{calendar_id}/events/{event_id}",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()


async def delete_event(
    access_token: str,
    calendar_id: str,
    event_id: str,
) -> None:
    """Delete a calendar event."""
    headers = await _headers(access_token)

    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{BASE_URL}/calendars/{calendar_id}/events/{event_id}",
            headers=headers,
        )
        # 410 Gone is fine — event was already deleted
        if resp.status_code not in (200, 204, 410):
            resp.raise_for_status()


# ── Helpers ─────────────────────────────────────────────────────


def _normalize_event(item: dict, calendar_color: str = "") -> dict:
    """Convert a Google Calendar event into our simplified format."""
    start_raw = item.get("start", {})
    end_raw = item.get("end", {})

    all_day = "date" in start_raw and "dateTime" not in start_raw

    return {
        "id": item["id"],
        "summary": item.get("summary", "(No title)"),
        "start": start_raw.get("dateTime") or start_raw.get("date", ""),
        "end": end_raw.get("dateTime") or end_raw.get("date", ""),
        "allDay": all_day,
        "color": calendar_color or None,
    }
