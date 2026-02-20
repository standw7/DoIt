from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
import app.models  # noqa: F401 — register all models with Base.metadata
from app.routers import auth, calendar, projects, recurring_tasks, settings as settings_router, tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (no-op if they already exist)
    Base.metadata.create_all(bind=engine)
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


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}
