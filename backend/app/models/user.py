import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    tasks: Mapped[list["Task"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    projects: Mapped[list["Project"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    recurring_tasks: Mapped[list["RecurringTask"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    settings: Mapped["UserSettings | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")  # noqa: F821
