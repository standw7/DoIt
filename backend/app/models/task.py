import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="backlog")
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    day: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)  # yyyy-MM-dd
    due_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    split_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    google_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auto_assigned: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_task_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("recurring_tasks.id", ondelete="SET NULL"), nullable=True
    )
    available_from: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="tasks")  # noqa: F821
    project: Mapped["Project | None"] = relationship(back_populates="tasks")  # noqa: F821
