#!/usr/bin/env python3
"""One-time migration script: Supabase Postgres → local SQLite.

Usage:
    pip install psycopg2-binary sqlalchemy
    SUPABASE_DB_URL="postgresql://..." python migrate_from_supabase.py

This connects to the Supabase Postgres database, reads all DoIt data,
and inserts it into the local SQLite database (creating tables if needed).
"""

import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Add parent to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import Base
from app.models.user import User
from app.models.task import Task
from app.models.project import Project
from app.models.recurring_task import RecurringTask
from app.models.user_settings import UserSettings


def migrate():
    supabase_url = os.environ.get("SUPABASE_DB_URL")
    sqlite_url = os.environ.get("DATABASE_URL", "sqlite:///./doit.db")

    if not supabase_url:
        print("Error: Set SUPABASE_DB_URL environment variable")
        print("  Example: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres")
        sys.exit(1)

    print(f"Source: {supabase_url[:50]}...")
    print(f"Target: {sqlite_url}")

    # Connect to both databases
    pg_engine = create_engine(supabase_url)
    sqlite_engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False} if "sqlite" in sqlite_url else {},
    )

    # Create all tables in SQLite
    Base.metadata.create_all(bind=sqlite_engine)

    with Session(pg_engine) as pg, Session(sqlite_engine) as sq:
        # 1. Migrate users (from auth.users — Supabase auth schema)
        print("\n--- Users ---")
        rows = pg.execute(text(
            "SELECT id, email, created_at FROM auth.users"
        )).fetchall()
        for row in rows:
            user = User(
                id=str(row[0]),
                email=row[1],
                password_hash="$migrated$",  # Users will need to reset password
                created_at=row[2],
                updated_at=row[2],
            )
            sq.merge(user)
        print(f"  Migrated {len(rows)} users")

        # 2. Migrate projects
        print("\n--- Projects ---")
        rows = pg.execute(text(
            "SELECT id, user_id, name, goal, definition_of_done, created_at FROM projects"
        )).fetchall()
        for row in rows:
            project = Project(
                id=str(row[0]),
                user_id=str(row[1]),
                name=row[2],
                goal=row[3],
                definition_of_done=row[4],
                created_at=row[5],
                updated_at=row[5],
            )
            sq.merge(project)
        print(f"  Migrated {len(rows)} projects")

        # 3. Migrate recurring tasks
        print("\n--- Recurring Tasks ---")
        rows = pg.execute(text(
            "SELECT id, user_id, name, description, estimated_minutes, priority, "
            "project_id, recurrence_day, available_days_before, start_date, end_date, "
            "active, created_at FROM recurring_tasks"
        )).fetchall()
        for row in rows:
            rt = RecurringTask(
                id=str(row[0]),
                user_id=str(row[1]),
                name=row[2],
                description=row[3],
                estimated_minutes=row[4],
                priority=row[5],
                project_id=str(row[6]) if row[6] else None,
                recurrence_day=row[7],
                available_days_before=row[8],
                start_date=row[9],
                end_date=row[10],
                active=row[11],
                created_at=row[12],
                updated_at=row[12],
            )
            sq.merge(rt)
        print(f"  Migrated {len(rows)} recurring tasks")

        # 4. Migrate tasks
        print("\n--- Tasks ---")
        rows = pg.execute(text(
            "SELECT id, user_id, project_id, name, description, status, priority, "
            "day, due_date, estimated_minutes, split_allowed, tags, sort_order, "
            "google_event_id, auto_assigned, recurring_task_id, available_from, "
            "created_at FROM tasks"
        )).fetchall()
        for row in rows:
            import json
            task = Task(
                id=str(row[0]),
                user_id=str(row[1]),
                project_id=str(row[2]) if row[2] else None,
                name=row[3],
                description=row[4],
                status=row[5] or "backlog",
                priority=row[6] or "medium",
                day=row[7],
                due_date=row[8],
                estimated_minutes=row[9],
                split_allowed=row[10] or False,
                tags=json.dumps(row[11]) if row[11] else None,
                sort_order=row[12] or 0,
                google_event_id=row[13],
                auto_assigned=row[14] or False,
                recurring_task_id=str(row[15]) if row[15] else None,
                available_from=row[16],
                created_at=row[17],
                updated_at=row[17],
            )
            sq.merge(task)
        print(f"  Migrated {len(rows)} tasks")

        # 5. Migrate user settings
        print("\n--- User Settings ---")
        rows = pg.execute(text(
            "SELECT id, user_id, working_hours_start, working_hours_end, "
            "daily_minutes_budget, auto_assign_enabled, doit_calendar_id, "
            "google_refresh_token, created_at FROM user_settings"
        )).fetchall()
        for row in rows:
            us = UserSettings(
                id=str(row[0]),
                user_id=str(row[1]),
                working_hours_start=row[2] or "09:00",
                working_hours_end=row[3] or "17:00",
                daily_minutes_budget=row[4] or 120,
                auto_assign_enabled=row[5] if row[5] is not None else True,
                doit_calendar_id=row[6],
                google_refresh_token=row[7],
                created_at=row[8],
                updated_at=row[8],
            )
            sq.merge(us)
        print(f"  Migrated {len(rows)} user settings")

        sq.commit()

    print("\n✓ Migration complete!")
    print("Note: Users will need to create new passwords (old Supabase auth passwords were not migrated)")


if __name__ == "__main__":
    migrate()
