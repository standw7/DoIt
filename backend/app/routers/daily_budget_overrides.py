from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.daily_budget_override import DailyBudgetOverride
from app.models.user import User
from app.schemas.daily_budget_override import (
    DailyBudgetOverrideResponse,
    DailyBudgetOverrideUpsert,
)

router = APIRouter(prefix="/daily-budget-overrides", tags=["daily-budget-overrides"])


@router.get("/", response_model=DailyBudgetOverrideResponse | None)
def get_override(
    date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = (
        db.query(DailyBudgetOverride)
        .filter(
            DailyBudgetOverride.user_id == current_user.id,
            DailyBudgetOverride.date == date,
        )
        .first()
    )
    return override


@router.get("/range", response_model=list[DailyBudgetOverrideResponse])
def get_overrides_range(
    start: str,
    end: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(DailyBudgetOverride)
        .filter(
            DailyBudgetOverride.user_id == current_user.id,
            DailyBudgetOverride.date >= start,
            DailyBudgetOverride.date <= end,
        )
        .all()
    )


@router.put("/", response_model=DailyBudgetOverrideResponse)
def upsert_override(
    body: DailyBudgetOverrideUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = (
        db.query(DailyBudgetOverride)
        .filter(
            DailyBudgetOverride.user_id == current_user.id,
            DailyBudgetOverride.date == body.date,
        )
        .first()
    )
    if override:
        override.minutes_budget = body.minutes_budget
    else:
        override = DailyBudgetOverride(
            user_id=current_user.id,
            date=body.date,
            minutes_budget=body.minutes_budget,
        )
        db.add(override)
    db.commit()
    db.refresh(override)
    return override


@router.delete("/{date}")
def delete_override(
    date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = (
        db.query(DailyBudgetOverride)
        .filter(
            DailyBudgetOverride.user_id == current_user.id,
            DailyBudgetOverride.date == date,
        )
        .first()
    )
    if not override:
        raise HTTPException(status_code=404, detail="No override for that date")
    db.delete(override)
    db.commit()
    return {"ok": True}
