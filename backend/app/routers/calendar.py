"""Calendar router — Google Calendar event CRUD + setup."""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.user import User
from app.models.user_settings import UserSettings
from app.services import google_auth, google_calendar
from app.services.ical_service import fetch_ical_events

router = APIRouter(prefix="/calendar", tags=["calendar"])


# ── Schemas ─────────────────────────────────────────────────────


class CreateEventRequest(BaseModel):
    summary: str
    description: str | None = None
    startDateTime: str
    endDateTime: str
    taskId: str | None = None


class UpdateEventRequest(BaseModel):
    startDateTime: str | None = None
    endDateTime: str | None = None


class CalendarEventResponse(BaseModel):
    id: str
    summary: str
    start: str
    end: str
    allDay: bool
    color: str | None = None
    doitTaskId: str | None = None


class SetupResponse(BaseModel):
    calendarId: str


# ── Helpers ─────────────────────────────────────────────────────


async def _get_access_token(settings_row: UserSettings) -> str:
    """Get a fresh Google access token from the stored refresh token."""
    if not settings_row.google_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar is not connected. Please connect in Settings.",
        )
    try:
        return await google_auth.refresh_access_token(settings_row.google_refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token expired — please reconnect in Settings.",
        )


def _get_settings(db: Session, user_id: str) -> UserSettings:
    """Fetch user settings, raise 400 if not found."""
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=400, detail="User settings not found")
    return row


# ── Routes ──────────────────────────────────────────────────────


@router.get("/events", response_model=list[CalendarEventResponse])
async def list_events(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List calendar events from Google Calendar + iCal feeds within a date range."""
    user_settings = _get_settings(db, current_user.id)
    all_events: list[dict] = []

    # Fetch Google Calendar events if connected
    if user_settings.google_refresh_token:
        try:
            access_token = await _get_access_token(user_settings)
            google_events = await google_calendar.list_all_events(
                access_token, start, end,
                doit_calendar_id=user_settings.doit_calendar_id,
            )
            all_events.extend(google_events)
        except Exception:
            pass

    # Fetch iCal events if URLs are configured
    if user_settings.ical_urls:
        try:
            urls = json.loads(user_settings.ical_urls) if isinstance(user_settings.ical_urls, str) else user_settings.ical_urls
            if urls:
                ical_events = await fetch_ical_events(urls, start, end)
                all_events.extend(ical_events)
        except Exception:
            pass

    return all_events


@router.post("/events")
async def create_event(
    body: CreateEventRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new calendar event."""
    user_settings = _get_settings(db, current_user.id)

    if not user_settings.doit_calendar_id:
        raise HTTPException(status_code=400, detail="Calendar not set up. Run setup first.")

    access_token = await _get_access_token(user_settings)
    event_id = await google_calendar.create_event(
        access_token=access_token,
        calendar_id=user_settings.doit_calendar_id,
        summary=body.summary,
        start_datetime=body.startDateTime,
        end_datetime=body.endDateTime,
        description=body.description,
        task_id=body.taskId,
    )
    return {"eventId": event_id}


@router.patch("/events/{event_id}")
async def update_event(
    event_id: str,
    body: UpdateEventRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a calendar event's start/end times."""
    user_settings = _get_settings(db, current_user.id)

    if not user_settings.doit_calendar_id:
        raise HTTPException(status_code=400, detail="Calendar not set up.")

    access_token = await _get_access_token(user_settings)
    await google_calendar.update_event(
        access_token=access_token,
        calendar_id=user_settings.doit_calendar_id,
        event_id=event_id,
        start_datetime=body.startDateTime,
        end_datetime=body.endDateTime,
    )
    return {"ok": True}


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a calendar event."""
    user_settings = _get_settings(db, current_user.id)

    if not user_settings.doit_calendar_id:
        raise HTTPException(status_code=400, detail="Calendar not set up.")

    access_token = await _get_access_token(user_settings)
    await google_calendar.delete_event(
        access_token=access_token,
        calendar_id=user_settings.doit_calendar_id,
        event_id=event_id,
    )
    return {"ok": True}


@router.post("/setup", response_model=SetupResponse)
async def setup_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Find or create the DoIt calendar on the user's Google account."""
    user_settings = _get_settings(db, current_user.id)
    access_token = await _get_access_token(user_settings)

    calendar_id = await google_calendar.find_or_create_doit_calendar(access_token)

    user_settings.doit_calendar_id = calendar_id
    db.commit()

    return SetupResponse(calendarId=calendar_id)
