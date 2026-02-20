from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.recurring_task import RecurringTask
from app.models.task import Task
from app.models.user import User
from app.schemas.recurring_task import (
    RecurringTaskCreate,
    RecurringTaskResponse,
    RecurringTaskUpdate,
)
from app.schemas.task import TaskResponse

router = APIRouter(prefix="/recurring-tasks", tags=["recurring-tasks"])


@router.get("/", response_model=list[RecurringTaskResponse])
def list_recurring_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RecurringTask]:
    """List all recurring task templates."""
    return (
        db.query(RecurringTask)
        .filter(RecurringTask.user_id == current_user.id)
        .order_by(RecurringTask.recurrence_day, RecurringTask.name)
        .all()
    )


@router.post("/", response_model=RecurringTaskResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_task(
    body: RecurringTaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecurringTask:
    """Create a new recurring task template."""
    rt = RecurringTask(user_id=current_user.id, **body.model_dump())
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return rt


@router.put("/{rt_id}", response_model=RecurringTaskResponse)
def update_recurring_task(
    rt_id: str,
    body: RecurringTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecurringTask:
    """Update a recurring task template by ID."""
    rt = (
        db.query(RecurringTask)
        .filter(RecurringTask.id == rt_id, RecurringTask.user_id == current_user.id)
        .first()
    )
    if not rt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring task not found")

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(rt, key, value)

    db.commit()
    db.refresh(rt)
    return rt


@router.delete("/{rt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_task(
    rt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a recurring task template by ID."""
    rt = (
        db.query(RecurringTask)
        .filter(RecurringTask.id == rt_id, RecurringTask.user_id == current_user.id)
        .first()
    )
    if not rt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring task not found")

    db.delete(rt)
    db.commit()


@router.post("/generate", response_model=list[TaskResponse])
def generate_recurring_instances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Task]:
    """Generate task instances from recurring templates.

    Looks 2 weeks ahead and creates task instances for any gaps.
    Returns the list of newly created tasks.
    """
    templates = (
        db.query(RecurringTask)
        .filter(RecurringTask.user_id == current_user.id, RecurringTask.active == True)  # noqa: E712
        .all()
    )

    existing_tasks = db.query(Task).filter(Task.user_id == current_user.id).all()

    today = date.today()
    horizon = today + timedelta(weeks=2)
    created_tasks: list[Task] = []

    for template in templates:
        start = date.fromisoformat(template.start_date)
        end = date.fromisoformat(template.end_date) if template.end_date else None

        # Find first occurrence from today (or start_date if future)
        cursor = max(start, today)

        # Advance to the next target weekday
        target_day = template.recurrence_day  # 0=Sunday ... 6=Saturday
        # Python weekday: 0=Monday ... 6=Sunday — convert
        python_target = (target_day - 1) % 7  # Sun(0)->6, Mon(1)->0, ...

        while cursor.weekday() != python_target:
            cursor += timedelta(days=1)

        while cursor <= horizon:
            if end and cursor > end:
                break
            if cursor >= start:
                date_str = cursor.isoformat()

                # Check if instance already exists
                already_exists = any(
                    t.recurring_task_id == template.id and t.due_date == date_str
                    for t in existing_tasks
                )

                if not already_exists:
                    available_from = None
                    if template.available_days_before is not None:
                        af = cursor - timedelta(days=template.available_days_before)
                        available_from = af.isoformat()

                    task = Task(
                        user_id=current_user.id,
                        name=template.name,
                        description=template.description,
                        estimated_minutes=template.estimated_minutes,
                        priority=template.priority,
                        project_id=template.project_id,
                        due_date=date_str,
                        day=date_str,
                        status="planned",
                        sort_order=0,
                        split_allowed=False,
                        auto_assigned=True,
                        recurring_task_id=template.id,
                        available_from=available_from,
                    )
                    db.add(task)
                    created_tasks.append(task)

            cursor += timedelta(weeks=1)

    if created_tasks:
        db.commit()
        for t in created_tasks:
            db.refresh(t)

    return created_tasks
