from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Subject, Project, GmailAccount, User
from app.schemas.core import (
    SubjectCreate,
    SubjectUpdate,
    SubjectRead,
    ProjectCreate,
    ProjectUpdate,
    ProjectRead,
    AssignGmailAccountRequest,
)

router = APIRouter(prefix="/subjects", tags=["Subjects"])


def require_professor(user: User) -> None:
    if user.role != "professor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Professor role required.",
        )


@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
async def create_subject(
    payload: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_professor(current_user)

    subject = Subject(
        name=payload.name,
        description=payload.description,
        professor_id=current_user.id,
    )

    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.get("", response_model=list[SubjectRead])
async def list_subjects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "professor":
        result = await db.execute(
            select(Subject).where(Subject.professor_id == current_user.id)
        )
    else:
        result = await db.execute(select(Subject))

    return result.scalars().all()


@router.put("/{subject_id}", response_model=SubjectRead)
async def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_professor(current_user)

    subject = await db.get(Subject, subject_id)

    if not subject or subject.professor_id != current_user.id:
        raise HTTPException(status_code=404, detail="Subject not found.")

    data = payload.model_dump(exclude_unset=True)

    for key, value in data.items():
        setattr(subject, key, value)

    await db.commit()
    await db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_professor(current_user)

    subject = await db.get(Subject, subject_id)

    if not subject or subject.professor_id != current_user.id:
        raise HTTPException(status_code=404, detail="Subject not found.")

    await db.delete(subject)
    await db.commit()
    return None


@router.post("/{subject_id}/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    subject_id: int,
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_professor(current_user)

    subject = await db.get(Subject, subject_id)

    if not subject or subject.professor_id != current_user.id:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if payload.gmail_account_id is not None:
        gmail_account = await db.get(GmailAccount, payload.gmail_account_id)

        if not gmail_account or gmail_account.professor_id != current_user.id:
            raise HTTPException(status_code=400, detail="Invalid Gmail account.")

    project = Project(
        subject_id=subject_id,
        name=payload.name,
        description=payload.description,
        topic=payload.topic,
        gmail_account_id=payload.gmail_account_id,
    )

    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{subject_id}/projects", response_model=list[ProjectRead])
async def list_projects(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subject = await db.get(Subject, subject_id)

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if current_user.role == "professor" and subject.professor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your subject.")

    result = await db.execute(
        select(Project).where(Project.subject_id == subject_id)
    )

    return result.scalars().all()


@router.put("/{subject_id}/projects/{project_id}", response_model=ProjectRead)
async def update_project(
    subject_id: int,
    project_id: int,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_professor(current_user)

    subject = await db.get(Subject, subject_id)

    if not subject or subject.professor_id != current_user.id:
        raise HTTPException(status_code=404, detail="Subject not found.")

    project = await db.get(Project, project_id)

    if not project or project.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Project not found.")

    data = payload.model_dump(exclude_unset=True)

    if "gmail_account_id" in data and data["gmail_account_id"] is not None:
        gmail_account = await db.get(GmailAccount, data["gmail_account_id"])

        if not gmail_account or gmail_account.professor_id != current_user.id:
            raise HTTPException(status_code=400, detail="Invalid Gmail account.")

    for key, value in data.items():
        setattr(project, key, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{subject_id}/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    subject_id: int,
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_professor(current_user)

    subject = await db.get(Subject, subject_id)

    if not subject or subject.professor_id != current_user.id:
        raise HTTPException(status_code=404, detail="Subject not found.")

    project = await db.get(Project, project_id)

    if not project or project.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Project not found.")

    await db.delete(project)
    await db.commit()
    return None


@router.patch("/projects/{project_id}/gmail-account", response_model=ProjectRead)
async def assign_gmail_account_to_project(
    project_id: int,
    payload: AssignGmailAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_professor(current_user)

    project = await db.get(Project, project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    subject = await db.get(Subject, project.subject_id)

    if not subject or subject.professor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your project.")

    if payload.gmail_account_id is not None:
        gmail_account = await db.get(GmailAccount, payload.gmail_account_id)

        if not gmail_account or gmail_account.professor_id != current_user.id:
            raise HTTPException(status_code=400, detail="Invalid Gmail account.")

    project.gmail_account_id = payload.gmail_account_id

    await db.commit()
    await db.refresh(project)
    return project