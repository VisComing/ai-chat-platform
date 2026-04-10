from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
):
    """List user's sessions"""
    # Build query conditions
    conditions = [Session.user_id == user_id]

    # Filters
    if not archived:
        conditions.append(Session.archived == False)

    if pinned is not None:
        conditions.append(Session.pinned == pinned)

    if search:
        # MongoDB regex search for title
        conditions.append(Session.title.match(search))

    # Count total
    total = await Session.find(*conditions).count()

    # Get paginated results
    # Sort: pinned first, then by updated_at (fallback to created_at)
    # MongoDB doesn't have coalesce, so we use aggregation or sort by updated_at descending
    # Since updated_at is null for new sessions, we need to handle this
    sessions = await Session.find(*conditions).sort(
        [("pinned", -1), ("updated_at", -1), ("created_at", -1)]
    ).skip((page - 1) * limit).limit(limit).to_list()

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
):
    """Create a new session"""
    session = Session(
        user_id=user_id,
        title=request.title or "新对话",
        system_prompt=request.systemPrompt,
        default_model=request.defaultModel,
    )
    await session.insert()

    return ApiResponse(
        success=True,
        data=SessionResponse.model_validate(session).model_dump(),
    )


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get session by ID"""
    session = await Session.find_one(
        Session.id == session_id,
        Session.user_id == user_id,
    )

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
):
    """Update session"""
    session = await Session.find_one(
        Session.id == session_id,
        Session.user_id == user_id,
    )

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
    await session.save()

    return ApiResponse(
        success=True,
        data=SessionResponse.model_validate(session).model_dump(),
    )


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Delete session"""
    session = await Session.find_one(
        Session.id == session_id,
        Session.user_id == user_id,
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    await session.delete()

    return ApiResponse(success=True, message="会话已删除")


@router.post("/{session_id}/pin")
async def pin_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Pin/unpin session"""
    session = await Session.find_one(
        Session.id == session_id,
        Session.user_id == user_id,
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    session.pinned = not session.pinned
    session.updated_at = datetime.utcnow()
    await session.save()

    return ApiResponse(success=True, data={"pinned": session.pinned})


@router.post("/{session_id}/archive")
async def archive_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Archive/unarchive session"""
    session = await Session.find_one(
        Session.id == session_id,
        Session.user_id == user_id,
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    session.archived = not session.archived
    session.updated_at = datetime.utcnow()
    await session.save()

    return ApiResponse(success=True, data={"archived": session.archived})


@router.get("/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user_id: str = Depends(get_current_user_id),
):
    """Get session messages"""
    # Verify session belongs to user
    session = await Session.find_one(
        Session.id == session_id,
        Session.user_id == user_id,
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    # Mark any interrupted streaming messages as cancelled
    # This happens when user refreshes during streaming
    streaming_messages = await Message.find(
        Message.session_id == session_id,
        Message.status == "streaming"
    ).to_list()

    for msg in streaming_messages:
        msg.status = "cancelled"
        # Add a note if the message is empty
        if not msg.content.get("text"):
            msg.content = {"type": "text", "text": "[回复被中断]"}
        await msg.save()

    # Get messages
    messages = await Message.find(
        Message.session_id == session_id
    ).sort("created_at").skip((page - 1) * limit).limit(limit).to_list()

    return ApiResponse(
        success=True,
        data=[MessageResponse.model_validate(m).model_dump() for m in messages],
    )