"""iCal feed fetcher — fetches events from iCal URLs and returns them as dicts."""

import hashlib
from datetime import date, datetime, timezone

import httpx
from dateutil.parser import parse as dateutil_parse
from icalendar import Calendar
from recurring_ical_events import of as recurring_of

ICAL_COLOR = "#9E9E9E"


def _stable_id(url: str, uid: str, dt: date | datetime) -> str:
    """Generate a stable event ID from URL + UID + date."""
    raw = f"{url}:{uid}:{dt.isoformat()}"
    return "ical-" + hashlib.sha256(raw.encode()).hexdigest()[:12]


def _to_iso(dt: date | datetime) -> str:
    """Convert a date or datetime to ISO 8601 string."""
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    return dt.isoformat()


async def fetch_ical_events(
    ical_urls: list[str],
    time_min: str,
    time_max: str,
) -> list[dict]:
    """Fetch events from multiple iCal URLs within a date range.

    Returns dicts matching CalendarEventResponse schema.
    Errors are silently skipped per-feed.
    """
    start_dt = dateutil_parse(time_min).date() if isinstance(dateutil_parse(time_min), datetime) else dateutil_parse(time_min).date()
    end_dt = dateutil_parse(time_max).date() if isinstance(dateutil_parse(time_max), datetime) else dateutil_parse(time_max).date()

    all_events: list[dict] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for url in ical_urls:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                cal = Calendar.from_ical(resp.text)
                events = recurring_of(cal).between(start_dt, end_dt)

                for event in events:
                    uid = str(event.get("UID", ""))
                    summary = str(event.get("SUMMARY", "Untitled"))
                    dtstart = event.get("DTSTART").dt
                    dtend_prop = event.get("DTEND")
                    dtend = dtend_prop.dt if dtend_prop else dtstart

                    all_day = isinstance(dtstart, date) and not isinstance(dtstart, datetime)

                    all_events.append({
                        "id": _stable_id(url, uid, dtstart),
                        "summary": summary,
                        "start": _to_iso(dtstart),
                        "end": _to_iso(dtend),
                        "allDay": all_day,
                        "color": ICAL_COLOR,
                        "doitTaskId": None,
                    })
            except Exception:
                continue

    return all_events
