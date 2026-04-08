from datetime import datetime
from typing import Optional, List, Any, Union, Generic, TypeVar
from pydantic import BaseModel, EmailStr, Field


# ============= Generic Response Wrapper =============

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    """Unified API response wrapper"""
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None


class ErrorDetail(BaseModel):
    """Error detail"""
    code: str
    message: str
    details: Optional[dict] = None


class PaginatedData(BaseModel, Generic[T]):
    """Paginated data wrapper"""
    data: List[Any]
    total: int
    page: int
    limit: int
    hasMore: bool


# ============= User Schemas =============

class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)


class UserCreate(UserBase):
    """User creation schema"""
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    """User update schema"""
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    avatar: Optional[str] = None


class UserResponse(UserBase):
    """User response schema"""
    id: str
    avatar: Optional[str] = None
    isActive: bool = Field(alias="is_active", default=True)
    isVerified: bool = Field(alias="is_verified", default=False)
    createdAt: datetime = Field(alias="created_at")

    class Config:
        from_attributes = True
        populate_by_name = True


class UserSettingsBase(BaseModel):
    """User settings schema"""
    theme: str = "system"
    language: str = "zh-CN"
    defaultModel: str = Field(alias="default_model", default="gpt-4")
    temperature: float = 0.7
    maxTokens: int = Field(alias="max_tokens", default=4096)
    enableThinking: bool = Field(alias="enable_thinking", default=False)
    enableShortcuts: bool = Field(alias="enable_shortcuts", default=True)
    enableSoundEffects: bool = Field(alias="enable_sound_effects", default=False)


class UserSettingsUpdate(BaseModel):
    """User settings update schema"""
    theme: Optional[str] = None
    language: Optional[str] = None
    defaultModel: Optional[str] = Field(None, alias="default_model")
    temperature: Optional[float] = None
    maxTokens: Optional[int] = Field(None, alias="max_tokens")
    enableThinking: Optional[bool] = Field(None, alias="enable_thinking")
    enableShortcuts: Optional[bool] = Field(None, alias="enable_shortcuts")
    enableSoundEffects: Optional[bool] = Field(None, alias="enable_sound_effects")

    class Config:
        populate_by_name = True


class UserSettingsResponse(UserSettingsBase):
    """User settings response"""
    id: str
    userId: str = Field(alias="user_id")

    class Config:
        from_attributes = True
        populate_by_name = True


# ============= Auth Schemas =============

class LoginRequest(BaseModel):
    """Login request - supports username or email"""
    account: str  # Can be email or username
    password: str


class LoginData(BaseModel):
    """Login data"""
    user: UserResponse
    accessToken: str
    refreshToken: str


class RegisterRequest(UserCreate):
    """Register request"""
    pass


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refreshToken: str


# ============= Session Schemas =============

class SessionCreate(BaseModel):
    """Session creation schema"""
    title: Optional[str] = None
    systemPrompt: Optional[str] = Field(None, alias="system_prompt")
    defaultModel: Optional[str] = Field("gpt-4", alias="default_model")
    
    class Config:
        populate_by_name = True


class SessionUpdate(BaseModel):
    """Session update schema"""
    title: Optional[str] = None
    systemPrompt: Optional[str] = Field(None, alias="system_prompt")
    defaultModel: Optional[str] = Field(None, alias="default_model")
    pinned: Optional[bool] = None
    
    class Config:
        populate_by_name = True


class SessionResponse(BaseModel):
    """Session response schema"""
    id: str
    userId: str = Field(alias="user_id")
    title: str
    systemPrompt: Optional[str] = Field(None, alias="system_prompt")
    defaultModel: str = Field(alias="default_model")
    pinned: bool
    archived: bool
    messageCount: int = Field(alias="message_count")
    lastMessageAt: Optional[datetime] = Field(None, alias="last_message_at")
    createdAt: datetime = Field(alias="created_at")
    updatedAt: Optional[datetime] = Field(None, alias="updated_at")

    class Config:
        from_attributes = True
        populate_by_name = True


# ============= Message Schemas =============

class MessageContent(BaseModel):
    """Message content schema"""
    type: str  # text, image, file, code, mixed
    text: Optional[str] = None
    url: Optional[str] = None
    alt: Optional[str] = None
    name: Optional[str] = None
    size: Optional[int] = None
    mimeType: Optional[str] = Field(None, alias="mime_type")
    language: Optional[str] = None
    code: Optional[str] = None
    output: Optional[str] = None
    parts: Optional[List["MessageContent"]] = None
    
    class Config:
        populate_by_name = True


class MessageMetadata(BaseModel):
    """Message metadata schema"""
    model: Optional[str] = None
    tokens: Optional[dict] = None
    thinking: Optional[str] = None
    sources: Optional[List[dict]] = None
    duration: Optional[float] = None


class MessageCreate(BaseModel):
    """Message creation schema"""
    content: Union[MessageContent, dict]
    role: str = "user"


class MessageResponse(BaseModel):
    """Message response schema"""
    id: str
    sessionId: str = Field(alias="session_id")
    role: str
    content: dict
    status: str
    metadata: Optional[dict] = Field(None, alias="meta")
    createdAt: datetime = Field(alias="created_at")
    updatedAt: Optional[datetime] = Field(None, alias="updated_at")

    class Config:
        from_attributes = True
        populate_by_name = True


# ============= Chat Schemas =============

class ChatRequest(BaseModel):
    """Chat request schema"""
    sessionId: Optional[str] = Field(None, alias="session_id")
    content: Union[MessageContent, dict]
    model: Optional[str] = None  # Will use settings.default_model
    temperature: Optional[float] = 0.7
    maxTokens: Optional[int] = Field(4096, alias="max_tokens")
    enableThinking: Optional[bool] = Field(False, alias="enable_thinking")
    useAgent: Optional[bool] = Field(True, alias="use_agent")  # Enable agent mode (with search)
    tools: Optional[List[dict]] = None
    metadata: Optional[dict] = None

    class Config:
        populate_by_name = True


class ChatStreamChunk(BaseModel):
    """Chat stream chunk schema"""
    type: str  # text, thinking, complete, error, tool_call
    content: Optional[str] = None
    messageId: Optional[str] = Field(None, alias="message_id")
    toolName: Optional[str] = Field(None, alias="tool_name")
    toolResult: Optional[Any] = Field(None, alias="tool_result")
    metadata: Optional[dict] = None
    
    class Config:
        populate_by_name = True


# ============= File Schemas =============

class FileUploadResponse(BaseModel):
    """File upload response"""
    id: str
    name: str
    url: str
    size: int
    mimeType: Optional[str] = Field(None, alias="mime_type")
    
    class Config:
        populate_by_name = True


class FileResponse(BaseModel):
    """File response schema"""
    id: str
    userId: str = Field(alias="user_id")
    sessionId: Optional[str] = Field(None, alias="session_id")
    name: str
    size: int
    mimeType: Optional[str] = Field(None, alias="mime_type")
    createdAt: datetime = Field(alias="created_at")

    class Config:
        from_attributes = True
        populate_by_name = True