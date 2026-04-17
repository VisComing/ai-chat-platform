"""
MongoDB Database Configuration using Motor + Beanie
"""
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document
from typing import Optional

from app.core.config import settings


# MongoDB Client
motor_client: Optional[AsyncIOMotorClient] = None


async def init_db():
    """Initialize MongoDB connection and Beanie ODM"""
    global motor_client

    # Create Motor client
    motor_client = AsyncIOMotorClient(
        settings.mongodb_url,
        maxPoolSize=settings.mongodb_max_pool_size,
        minPoolSize=settings.mongodb_min_pool_size,
    )

    # Get database - access via attribute, not callable
    database = motor_client[settings.mongodb_db_name]

    # Import all models for Beanie initialization
    from app.models.models import User, UserSettings, Session, Message, File, ChatTask
    from app.models.research import ResearchTask, ResearchClarification
    from app.models.model_trace import ModelTrace

    # Initialize Beanie with all document models
    await init_beanie(
        database=database,
        document_models=[
            User,
            UserSettings,
            Session,
            Message,
            File,
            ChatTask,
            ResearchTask,
            ResearchClarification,
            ModelTrace,
        ]
    )


async def close_db():
    """Close MongoDB connection"""
    global motor_client
    if motor_client:
        motor_client.close()
        motor_client = None


class DatabaseSession:
    """
    Compatibility layer for database operations.

    Provides a similar interface to SQLAlchemy AsyncSession,
    but operates on Beanie Documents directly.

    Note: MongoDB operations are auto-committed, so commit() is a no-op.
    """

    async def add(self, document: Document) -> Document:
        """Insert a new document"""
        await document.insert()
        return document

    async def delete(self, document: Document) -> bool:
        """Delete a document"""
        result = await document.delete()
        return result.deleted_count > 0

    async def commit(self):
        """No-op - MongoDB auto-commits each operation"""
        pass

    async def rollback(self):
        """No-op - MongoDB doesn't have transaction rollback without explicit transactions"""
        pass

    async def refresh(self, document: Document) -> Document:
        """Refresh document from database"""
        await document.sync()
        return document

    async def flush(self):
        """No-op - MongoDB doesn't have flush concept"""
        pass

    async def close(self):
        """No-op for compatibility"""
        pass

    async def execute(self, query):
        """Execute a query - for compatibility, but prefer direct Document methods"""
        # This is a compatibility shim - direct Beanie queries are preferred
        return query


async def get_db() -> DatabaseSession:
    """Dependency for getting database session"""
    return DatabaseSession()


# Export for convenience
__all__ = [
    "init_db",
    "close_db",
    "get_db",
    "DatabaseSession",
    "Document",
    "motor_client",
]