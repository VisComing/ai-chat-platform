from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.sql.functions import coalesce
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models import Session, Message
from app.schemas import (
    SessionCreate,
    SessionUpdate,
    SessionResponse,
    ApiResponse,
    MessageResponse,
)

router = APIRouter()


@router.get("")
async def list_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    archived: bool = Query(False),
    pinned: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List user's sessions"""
    # Build query
    query = select(Session).where(Session.user_id == user_id)
    count_query = select(func.count()).select_from(Session).where(Session.user_id == user_id)

    # Filters
    if not archived:
        query = query.where(Session.archived == False)
        count_query = count_query.where(Session.archived == False)

    if pinned is not None:
        query = query.where(Session.pinned == pinned)
        count_query = count_query.where(Session.pinned == pinned)

    if search:
        # Escape special SQL characters to prevent injection
        escaped_search = search.replace("%", r"\%").replace("_", r"\_")
        query = query.where(Session.title.contains(escaped_search))
        count_query = count_query.where(Session.title.contains(escaped_search))

    # Count total
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated results
    # Use coalesce to fallback to created_at when updated_at is NULL
    # This ensures newly created sessions (with NULL updated_at) appear at the top
    query = query.order_by(desc(Session.pinned), desc(coalesce(Session.updated_at, Session.created_at)))
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    sessions = result.scalars().all()

    return ApiResponse(
        success=True,
        data={
            "data": [SessionResponse.model_validate(s).model_dump() for s in sessions],
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": (page * limit) < total,
        },
    )


@router.post("")
async def create_session(
    request: SessionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new session"""
    session = Session(
        user_id=user_id,
        title=request.title or "新对话",
        system_prompt=request.systemPrompt,
        default_model=request.defaultModel,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return ApiResponse(
        success=True,
        data=SessionResponse.model_validate(session).model_dump(),
    )


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get session by ID"""
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    return ApiResponse(
        success=True,
        data=SessionResponse.model_validate(session).model_dump(),
    )


@router.patch("/{session_id}")
async def update_session(
    session_id: str,
    request: SessionUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update session"""
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    # Update fields
    if request.title is not None:
        session.title = request.title
    if request.systemPrompt is not None:
        session.system_prompt = request.systemPrompt
    if request.defaultModel is not None:
        session.default_model = request.defaultModel
    if request.pinned is not None:
        session.pinned = request.pinned

    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)

    return ApiResponse(
        success=True,
        data=SessionResponse.model_validate(session).model_dump(),
    )


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete session"""
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    await db.delete(session)
    await db.commit()

    return ApiResponse(success=True, message="会话已删除")


@router.post("/{session_id}/pin")
async def pin_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Pin/unpin session"""
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    session.pinned = not session.pinned
    session.updated_at = datetime.utcnow()
    await db.commit()

    return ApiResponse(success=True, data={"pinned": session.pinned})


@router.post("/{session_id}/archive")
async def archive_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Archive/unarchive session"""
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    session.archived = not session.archived
    session.updated_at = datetime.utcnow()
    await db.commit()

    return ApiResponse(success=True, data={"archived": session.archived})


@router.get("/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get session messages"""
    # Verify session belongs to user
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    # Mark any interrupted streaming messages as cancelled
    # This happens when user refreshes during streaming
    result = await db.execute(
        select(Message).where(
            Message.session_id == session_id,
            Message.status == "streaming"
        )
    )
    streaming_messages = result.scalars().all()
    for msg in streaming_messages:
        msg.status = "cancelled"
        # Add a note if the message is empty
        if not msg.content.get("text"):
            msg.content = {"type": "text", "text": "[回复被中断]"}
    if streaming_messages:
        await db.commit()

    # Get messages
    query = (
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    messages = result.scalars().all()

    return ApiResponse(
        success=True,
        data=[MessageResponse.model_validate(m).model_dump() for m in messages],
    )