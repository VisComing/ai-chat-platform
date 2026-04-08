import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.models import User


# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest_asyncio.fixture
async def test_db():
    """Create test database"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    yield async_session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture
async def client(test_db):
    """Create test client"""
    async def override_get_db():
        async with test_db() as session:
            yield session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, test_db):
    """Create authenticated user and return headers"""
    # Register user
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "testpassword123",
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Updated to use new response format (camelCase, nested in data)
    return {"Authorization": f"Bearer {data['data']['accessToken']}"}


class TestAuthAPI:
    """Test authentication API"""

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient):
        """Should register new user"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "password": "password123",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "accessToken" in data["data"]
        assert "refreshToken" in data["data"]
        assert data["data"]["user"]["email"] == "newuser@example.com"

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, auth_headers):
        """Should reject duplicate email"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "username": "anotheruser",
                "password": "password123",
            },
        )
        
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, auth_headers):
        """Should login successfully"""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "account": "test@example.com",
                "password": "testpassword123",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "accessToken" in data["data"]

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, auth_headers):
        """Should reject wrong password"""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "account": "test@example.com",
                "password": "wrongpassword",
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, auth_headers):
        """Should get current user"""
        response = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == "test@example.com"


class TestSessionsAPI:
    """Test sessions API"""

    @pytest.mark.asyncio
    async def test_create_session(self, client: AsyncClient, auth_headers):
        """Should create new session"""
        response = await client.post(
            "/api/v1/sessions",
            json={"title": "Test Session"},
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["title"] == "Test Session"
        assert "id" in data["data"]

    @pytest.mark.asyncio
    async def test_list_sessions(self, client: AsyncClient, auth_headers):
        """Should list sessions"""
        # Create a session first
        await client.post(
            "/api/v1/sessions",
            json={"title": "Test Session"},
            headers=auth_headers,
        )
        
        response = await client.get(
            "/api/v1/sessions",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["data"]) > 0

    @pytest.mark.asyncio
    async def test_get_session(self, client: AsyncClient, auth_headers):
        """Should get session by ID"""
        # Create session
        create_response = await client.post(
            "/api/v1/sessions",
            json={"title": "Test Session"},
            headers=auth_headers,
        )
        session_id = create_response.json()["data"]["id"]
        
        # Get session
        response = await client.get(
            f"/api/v1/sessions/{session_id}",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["id"] == session_id

    @pytest.mark.asyncio
    async def test_delete_session(self, client: AsyncClient, auth_headers):
        """Should delete session"""
        # Create session
        create_response = await client.post(
            "/api/v1/sessions",
            json={"title": "Test Session"},
            headers=auth_headers,
        )
        session_id = create_response.json()["data"]["id"]
        
        # Delete session
        response = await client.delete(
            f"/api/v1/sessions/{session_id}",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        
        # Verify deleted
        get_response = await client.get(
            f"/api/v1/sessions/{session_id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 404


class TestChatAPI:
    """Test chat API"""

    @pytest.mark.asyncio
    async def test_chat_stream(self, client: AsyncClient, auth_headers):
        """Should stream chat response"""
        # Create session first
        session_response = await client.post(
            "/api/v1/sessions",
            json={"title": "Test Session"},
            headers=auth_headers,
        )
        session_id = session_response.json()["data"]["id"]
        
        response = await client.post(
            "/api/v1/chat/stream",
            json={
                "sessionId": session_id,
                "content": {"type": "text", "text": "Hello"},
            },
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        # SSE response should contain event stream
        content_type = response.headers.get("content-type", "")
        assert "text/event-stream" in content_type or "application/x-ndjson" in content_type