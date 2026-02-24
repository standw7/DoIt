from datetime import datetime

from pydantic import BaseModel


class DailyBudgetOverrideUpsert(BaseModel):
    date: str
    minutes_budget: int


class DailyBudgetOverrideResponse(BaseModel):
    id: str
    user_id: str
    date: str
    minutes_budget: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
