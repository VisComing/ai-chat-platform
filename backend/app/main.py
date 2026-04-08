from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from app.core.config import settings
from app.core.database import init_db, close_db, async_session_maker
from app.core.security import get_password_hash
from app.api.v1 import auth, sessions, chat, users, files, speech, research
from app.models import User


async def create_test_user():
    """Create test user if not exists"""
    async with async_session_maker() as db:
        # Check if test user exists
        result = await db.execute(select(User).where(User.username == "testuser"))
        if result.scalar_one_or_none():
            return  # Already exists

        # Create test user
        test_user = User(
            email="testuser@example.com",
            username="testuser",
            password_hash=get_password_hash("testpass123"),
            is_active=True,
        )
        db.add(test_user)
        await db.commit()
        print("[Startup] Test user created: testuser / testpass123")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    await init_db()
    await create_test_user()
    yield
    # Shutdown
    await close_db()


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
app.include_router(research.router, prefix=f"{settings.api_prefix}/research", tags=["深度研究"])


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
    print("[TestWS] Connection attempt")
    await websocket.accept()
    print("[TestWS] Accepted")
    await websocket.send_json({"type": "connected", "message": "Hello!"})
    data = await websocket.receive_json()
    print(f"[TestWS] Received: {data}")
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
