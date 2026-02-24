from datetime import datetime

from pydantic import BaseModel


class TaskCreate(BaseModel):
    project_id: str | None = None
    name: str
    description: str | None = None
    status: str = "backlog"
    priority: str = "medium"
    day: str | None = None
    due_date: str | None = None
    estimated_minutes: int | None = None
    split_allowed: bool = False
    tags: list[str] | None = None
    sort_order: int = 0
    google_event_id: str | None = None
    auto_assigned: bool = False
    recurring_task_id: str | None = None
    available_from: str | None = None
    prefer_weekend: bool = False


class TaskUpdate(BaseModel):
    project_id: str | None = None
    name: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    day: str | None = None
    due_date: str | None = None
    estimated_minutes: int | None = None
    split_allowed: bool | None = None
    tags: list[str] | None = None
    sort_order: int | None = None
    google_event_id: str | None = None
    auto_assigned: bool | None = None
    recurring_task_id: str | None = None
    available_from: str | None = None
    prefer_weekend: bool | None = None


class TaskResponse(BaseModel):
    id: str
    user_id: str
    project_id: str | None = None
    name: str
    description: str | None = None
    status: str
    priority: str
    day: str | None = None
    due_date: str | None = None
    estimated_minutes: int | None = None
    split_allowed: bool
    tags: list[str] | None = None
    sort_order: int
    google_event_id: str | None = None
    auto_assigned: bool
    recurring_task_id: str | None = None
    available_from: str | None = None
    prefer_weekend: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
