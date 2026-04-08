import json
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas import ChatRequest
from app.services.chat_service import stream_chat
from app.services.ai_service import ai_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Unified chat stream endpoint

    Supports both normal chat and agent mode (with search capability).
    Set useAgent=true (default) to enable agent mode with automatic web search.
    Set enableThinking=true to enable deep thinking mode (for qwen3-max, etc.).

    SSE Events:
    - session: New session created
    - thinking: AI is thinking/reasoning (deep thinking mode) or Agent is analyzing
    - tool_call: Agent is calling a tool (e.g., web_search)
    - text: Text chunk from AI
    - title: Auto-generated conversation title
    - complete: Response complete
    - error: Error occurred
    """
    # Ensure content is a dict
    content = request.content
    if hasattr(content, 'model_dump'):
        content = content.model_dump()

    async def event_generator():
        async for event in stream_chat(
            db=db,
            user_id=user_id,
            session_id=request.sessionId,
            content=content,
            model=request.model,
            use_agent=request.useAgent,
            enable_thinking=request.enableThinking,
        ):
            yield event

    return EventSourceResponse(event_generator())


# Keep the old endpoint for backward compatibility (redirects to /stream)
@router.post("/agent/stream")
async def agent_stream(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Agent chat stream (deprecated - use /stream with useAgent=true)

    This endpoint is kept for backward compatibility.
    """
    # Force agent mode
    request.useAgent = True

    # Ensure content is a dict
    content = request.content
    if hasattr(content, 'model_dump'):
        content = content.model_dump()

    async def event_generator():
        async for event in stream_chat(
            db=db,
            user_id=user_id,
            session_id=request.sessionId,
            content=content,
            model=request.model,
            use_agent=True,
        ):
            yield event

    return EventSourceResponse(event_generator())


@router.get("/models")
async def get_supported_models():
    """Get list of supported AI models"""
    return {
        "success": True,
        "data": ai_service.get_supported_models()
    }