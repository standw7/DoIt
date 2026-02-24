from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ProjectWithProgressResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _with_progress(project: Project, db: Session) -> ProjectWithProgressResponse:
    """Calculate progress for a project from its tasks."""
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    task_count = len(tasks)
    done_count = sum(1 for t in tasks if t.status == "done")

    # Progress based on estimated minutes if ALL tasks have estimates,
    # otherwise fall back to simple task count
    all_have_estimates = all(t.estimated_minutes is not None for t in tasks)

    if task_count == 0:
        progress = 0.0
    elif all_have_estimates:
        total_minutes = sum(t.estimated_minutes for t in tasks)
        done_minutes = sum(t.estimated_minutes for t in tasks if t.status == "done")
        progress = round(done_minutes / total_minutes * 100, 1) if total_minutes > 0 else 0.0
    else:
        progress = round(done_count / task_count * 100, 1)

    return ProjectWithProgressResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        goal=project.goal,
        definition_of_done=project.definition_of_done,
        created_at=project.created_at,
        updated_at=project.updated_at,
        progress=progress,
        task_count=task_count,
        done_count=done_count,
    )


@router.get("/", response_model=list[ProjectWithProgressResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectWithProgressResponse]:
    """List all projects with progress information."""
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return [_with_progress(p, db) for p in projects]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    """Create a new project."""
    project = Project(user_id=current_user.id, **body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    """Update a project by ID."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a project by ID."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    db.delete(project)
    db.commit()
