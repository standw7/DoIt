from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    goal: str | None = None
    definition_of_done: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    goal: str | None = None
    definition_of_done: str | None = None


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: str
    goal: str | None = None
    definition_of_done: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectWithProgressResponse(ProjectResponse):
    progress: float = 0.0
    task_count: int = 0
    done_count: int = 0
