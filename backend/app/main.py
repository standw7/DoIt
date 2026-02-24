from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
import app.models  # noqa: F401 — register all models with Base.metadata
from app.routers import auth, calendar, daily_budget_overrides, projects, recurring_tasks, settings as settings_router, tasks


def _run_migrations():
    """Add missing columns to existing tables (SQLite has no ALTER COLUMN)."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        if "user_settings" in inspector.get_table_names():
            columns = {c["name"] for c in inspector.get_columns("user_settings")}
            if "skip_weekends" not in columns:
                conn.execute(text(
                    "ALTER TABLE user_settings ADD COLUMN skip_weekends BOOLEAN DEFAULT 0 NOT NULL"
                ))
            if "custom_weekly_budgets_enabled" not in columns:
                conn.execute(text(
                    "ALTER TABLE user_settings ADD COLUMN custom_weekly_budgets_enabled BOOLEAN DEFAULT 0 NOT NULL"
                ))
            for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
                col = f"budget_{day}"
                if col not in columns:
                    conn.execute(text(
                        f"ALTER TABLE user_settings ADD COLUMN {col} INTEGER"
                    ))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (no-op if they already exist)
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    yield


app = FastAPI(
    title="DoIt API",
    description="Backend API for DoIt — a calm daily list and project backlog system.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3003",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(projects.router)
app.include_router(recurring_tasks.router)
app.include_router(settings_router.router)
app.include_router(calendar.router)
app.include_router(daily_budget_overrides.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}
