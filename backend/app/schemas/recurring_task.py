from datetime import datetime

from pydantic import BaseModel


class RecurringTaskCreate(BaseModel):
    name: str
    description: str | None = None
    estimated_minutes: int = 30
    priority: str = "medium"
    project_id: str | None = None
    recurrence_day: int  # 0=Sunday ... 6=Saturday
    available_days_before: int | None = None
    start_date: str
    end_date: str | None = None
    active: bool = True


class RecurringTaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    estimated_minutes: int | None = None
    priority: str | None = None
    project_id: str | None = None
    recurrence_day: int | None = None
    available_days_before: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    active: bool | None = None


class RecurringTaskResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str | None = None
    estimated_minutes: int
    priority: str
    project_id: str | None = None
    recurrence_day: int
    available_days_before: int | None = None
    start_date: str
    end_date: str | None = None
    active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
