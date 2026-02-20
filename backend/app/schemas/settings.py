from datetime import datetime

from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    working_hours_start: str | None = None
    working_hours_end: str | None = None
    daily_minutes_budget: int | None = None
    auto_assign_enabled: bool | None = None
    doit_calendar_id: str | None = None
    google_refresh_token: str | None = None


class SettingsResponse(BaseModel):
    id: str
    user_id: str
    working_hours_start: str
    working_hours_end: str
    daily_minutes_budget: int
    auto_assign_enabled: bool
    doit_calendar_id: str | None = None
    google_refresh_token: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
