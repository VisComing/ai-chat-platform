"""
MongoDB Models using Beanie ODM
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import Field, field_validator
from beanie import Document, Indexed
from bson import ObjectId
import uuid


def generate_uuid() -> str:
    return str(uuid.uuid4())


def objectid_to_str(v: Any) -> str:
    """Convert ObjectId to string, keep string as-is"""
    if v is None:
        return generate_uuid()
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    return str(v)


class User(Document):
    """User document model"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    email: Indexed(str, unique=True)  # Unique email index
    username: Indexed(str, unique=True)  # Unique username index
    password_hash: str
    avatar: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "users"
        indexes = [
            "email",
            "username",
        ]

    class Config:
        populate_by_name = True


class UserSettings(Document):
    """User settings document model"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    user_id: Indexed(str, unique=True)  # One settings per user
    theme: str = "system"
    language: str = "zh-CN"
    default_model: str = "gpt-4"
    temperature: float = 0.7
    max_tokens: int = 4096
    enable_thinking: bool = False
    enable_shortcuts: bool = True
    enable_sound_effects: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "user_settings"
        indexes = ["user_id"]

    class Config:
        populate_by_name = True


class Session(Document):
    """Chat session document model"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    user_id: Indexed(str)  # Index for user queries
    title: str = "新对话"
    system_prompt: Optional[str] = None
    default_model: str = "gpt-4"
    pinned: bool = False
    archived: bool = False
    message_count: int = 0
    last_message_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    meta: Optional[Dict[str, Any]] = None

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "sessions"
        indexes = [
            "user_id",
            "created_at",
        ]

    class Config:
        populate_by_name = True


class Message(Document):
    """Chat message document model"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    session_id: Indexed(str)  # Index for session queries
    role: str  # user, assistant, system
    content: Dict[str, Any]  # JSON content
    status: str = "completed"  # pending, streaming, completed, error, cancelled
    meta: Optional[Dict[str, Any]] = None
    created_at: Indexed(datetime) = Field(default_factory=datetime.utcnow)  # Index for ordering
    updated_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "messages"
        indexes = [
            "session_id",
            "created_at",
        ]

    class Config:
        populate_by_name = True


class File(Document):
    """Uploaded file document model"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    user_id: Indexed(str)
    session_id: Optional[str] = None
    name: str
    path: str
    size: int
    mime_type: Optional[str] = None
    content: Optional[str] = None  # Parsed text content
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "files"
        indexes = ["user_id"]

    class Config:
        populate_by_name = True


class ChatTask(Document):
    """Chat generation task - enables resumable streaming"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    session_id: Indexed(str)
    message_id: Indexed(str)
    user_id: Indexed(str)
    status: Indexed(str) = "pending"  # pending, running, completed, failed, cancelled
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "chat_tasks"
        indexes = [
            "session_id",
            "message_id",
            "user_id",
            "status",
        ]

    class Config:
        populate_by_name = True


# Export all models
__all__ = [
    "User",
    "UserSettings",
    "Session",
    "Message",
    "File",
    "ChatTask",
    "generate_uuid",
]