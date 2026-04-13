from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db, close_db
from app.core.logging import setup_logging, get_logger
from app.core.security import get_password_hash
from app.api.v1 import auth, sessions, chat, users, files, speech, research, research_async, traces
from app.models import User
from app.services.otel_mongodb_exporter import mongodb_span_exporter

# Initialize logging
setup_logging()
logger = get_logger("app.main")

# ============================================================================
# Monkey Patch LangChain to handle reasoning_content (百炼 API 特有字段)
# ============================================================================
import langchain_openai.chat_models.base as lc_base
from typing import Mapping, Any, Dict, cast, Type
from langchain_core.messages import BaseMessageChunk, AIMessageChunk

_original_convert_delta = lc_base._convert_delta_to_message_chunk

def _convert_delta_with_reasoning(
    _dict: Mapping[str, Any], default_class: Type[BaseMessageChunk]
) -> BaseMessageChunk:
    """Patched version that handles reasoning_content"""
    result = _original_convert_delta(_dict, default_class)

    # 处理百炼 API 的 reasoning_content 字段
    if isinstance(result, AIMessageChunk) and _dict.get("reasoning_content"):
        result.additional_kwargs["reasoning_content"] = _dict["reasoning_content"]

    return result

lc_base._convert_delta_to_message_chunk = _convert_delta_with_reasoning
logger.info("LangChain patched to handle reasoning_content")

# Initialize Traceloop for LLM tracing
from traceloop.sdk import Traceloop
Traceloop.init(
    app_name="ai-chat-platform",
    exporter=mongodb_span_exporter,
    disable_batch=True,  # 立即发送 span，便于调试
)


async def create_test_user():
    """Create test user if not exists"""
    # Check if test user exists
    existing_user = await User.find_one(User.username == "testuser")
    if existing_user:
        return  # Already exists

    # Create test user
    test_user = User(
        email="testuser@example.com",
        username="testuser",
        password_hash=get_password_hash("testpass123"),
        is_active=True,
    )
    await test_user.insert()
    logger.info("Test user created: testuser / testpass123")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Application starting up...")
    await init_db()
    await create_test_user()
    logger.info("Application startup complete")
    yield
    # Shutdown
    logger.info("Application shutting down...")
    await close_db()
    logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI Chat Platform API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(exc) if settings.debug else "内部服务器错误",
            }
        }
    )


# Include API routes
app.include_router(auth.router, prefix=f"{settings.api_prefix}/auth", tags=["认证"])
app.include_router(users.router, prefix=f"{settings.api_prefix}/users", tags=["用户"])
app.include_router(sessions.router, prefix=f"{settings.api_prefix}/sessions", tags=["会话"])
app.include_router(chat.router, prefix=f"{settings.api_prefix}/chat", tags=["对话"])
app.include_router(files.router, prefix=f"{settings.api_prefix}/files", tags=["文件"])
app.include_router(research.router, prefix=f"{settings.api_prefix}/research", tags=["深度研究(同步)"])
app.include_router(research_async.router, prefix=f"{settings.api_prefix}/research", tags=["深度研究(异步)"])
app.include_router(traces.router, prefix=f"{settings.api_prefix}/traces", tags=["Trace追踪"])


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": settings.app_version}


# WebSocket endpoint for speech recognition
@app.websocket(f"{settings.api_prefix}/speech/stream")
async def speech_websocket(websocket: WebSocket):
    """Speech recognition WebSocket endpoint"""
    await speech.speech_stream_endpoint(websocket)


# Simple test WebSocket endpoint
@app.websocket("/ws/test")
async def test_websocket(websocket: WebSocket):
    """Simple test WebSocket endpoint"""
    logger.debug("TestWS: Connection attempt")
    await websocket.accept()
    logger.debug("TestWS: Accepted")
    await websocket.send_json({"type": "connected", "message": "Hello!"})
    data = await websocket.receive_json()
    logger.debug(f"TestWS: Received: {data}")
    await websocket.send_json({"type": "echo", "data": data})
    await websocket.close()


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }