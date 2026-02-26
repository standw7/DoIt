import json
from datetime import datetime

from pydantic import BaseModel, model_validator


class SettingsUpdate(BaseModel):
    working_hours_start: str | None = None
    working_hours_end: str | None = None
    daily_minutes_budget: int | None = None
    auto_assign_enabled: bool | None = None
    skip_weekends: bool | None = None
    custom_weekly_budgets_enabled: bool | None = None
    budget_monday: int | None = None
    budget_tuesday: int | None = None
    budget_wednesday: int | None = None
    budget_thursday: int | None = None
    budget_friday: int | None = None
    budget_saturday: int | None = None
    budget_sunday: int | None = None
    doit_calendar_id: str | None = None
    google_refresh_token: str | None = None
    ical_urls: list[str] | None = None


class SettingsResponse(BaseModel):
    id: str
    user_id: str
    working_hours_start: str
    working_hours_end: str
    daily_minutes_budget: int
    auto_assign_enabled: bool
    skip_weekends: bool
    custom_weekly_budgets_enabled: bool
    budget_monday: int | None = None
    budget_tuesday: int | None = None
    budget_wednesday: int | None = None
    budget_thursday: int | None = None
    budget_friday: int | None = None
    budget_saturday: int | None = None
    budget_sunday: int | None = None
    doit_calendar_id: str | None = None
    google_refresh_token: str | None = None
    ical_urls: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def deserialize_ical_urls(cls, data: any) -> any:
        """Deserialize ical_urls from JSON string (DB) to list."""
        # Handle ORM objects
        if hasattr(data, "ical_urls"):
            raw = data.ical_urls
            if isinstance(raw, str):
                try:
                    parsed = json.loads(raw)
                    # Can't set on ORM object directly; convert to dict
                    d = {c.key: getattr(data, c.key) for c in data.__table__.columns}
                    d["ical_urls"] = parsed
                    return d
                except (json.JSONDecodeError, TypeError):
                    pass
        # Handle dicts
        if isinstance(data, dict):
            raw = data.get("ical_urls")
            if isinstance(raw, str):
                try:
                    data["ical_urls"] = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    pass
        return data
