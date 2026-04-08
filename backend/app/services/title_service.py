"""
Title Generation Service
Handles automatic conversation title generation with SSE push
"""
import asyncio
import logging
from typing import AsyncGenerator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models import Session
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)


async def generate_and_push_title(
    session_id: str,
    user_message: str,
    ai_response: str = "",
) -> AsyncGenerator[dict, None]:
    """
    Generate title in background and yield SSE event when done

    Args:
        session_id: Session ID to update
        user_message: User's first message
        ai_response: AI's response (optional)

    Yields:
        SSE event dict with title update
    """
    try:
        # Generate title using AI service
        new_title = await ai_service.generate_title(
            user_message=user_message,
            ai_response=ai_response,
        )

        logger.info(f"[Title Service] Generated: {new_title}")

        # Update database in new session
        async with async_session_maker() as db:
            result = await db.execute(
                select(Session).where(Session.id == session_id)
            )
            session = result.scalar_one_or_none()
            if session:
                session.title = new_title
                from datetime import datetime
                session.updated_at = datetime.utcnow()
                await db.commit()
                logger.info(f"[Title Service] Updated session {session_id[:8]}")

        # Yield SSE event for frontend
        import json
        yield {
            "event": "title",
            "data": json.dumps({
                "type": "title",
                "title": new_title,
                "sessionId": session_id,
            }, ensure_ascii=False),
        }

    except Exception as e:
        logger.error(f"[Title Service] Failed: {e}")


async def start_title_generation(
    session_id: str,
    user_message: str,
    ai_response: str = "",
) -> asyncio.Task:
    """
    Start background task for title generation

    Returns:
        asyncio.Task that will yield SSE events
    """
    async def title_task():
        async for event in generate_and_push_title(session_id, user_message, ai_response):
            # Store event for later retrieval
            pass

    return asyncio.create_task(title_task())


class TitleEventCollector:
    """
    Collects title events for SSE streaming
    """

    def __init__(self):
        self.events: list[dict] = []

    async def collect(self, session_id: str, user_message: str, ai_response: str = ""):
        """Collect title generation events"""
        async for event in generate_and_push_title(session_id, user_message, ai_response):
            self.events.append(event)

    def get_events(self) -> list[dict]:
        """Get all collected events"""
        return self.events

    def clear(self):
        """Clear collected events"""
        self.events.clear()