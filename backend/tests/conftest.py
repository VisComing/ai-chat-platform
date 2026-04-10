"""
测试共享fixtures
"""
import pytest
import asyncio
from httpx import AsyncClient
from typing import AsyncGenerator

# 假设app可以从main导入
# 如果不行，需要调整
import sys
sys.path.insert(0, ".")


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """创建异步HTTP客户端"""
    from app.main import app
    from fastapi.testclient import TestClient

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    """创建认证header"""
    # 注册测试用户
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"test-{pytest.current_test_id}@example.com",
            "username": f"testuser-{pytest.current_test_id}",
            "password": "TestPassword123!"
        }
    )

    if response.status_code == 200:
        token = response.json()["data"]["accessToken"]
        return {"Authorization": f"Bearer {token}"}

    # 如果注册失败（可能已存在），尝试登录
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": f"test-{pytest.current_test_id}@example.com",
            "password": "TestPassword123!"
        }
    )
    token = response.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_session_id(client: AsyncClient, auth_headers: dict) -> str:
    """创建测试会话并返回ID"""
    response = await client.post(
        "/api/v1/sessions",
        headers=auth_headers,
        json={"title": "Test Session"}
    )
    return response.json()["data"]["id"]


# 用于生成唯一ID
@pytest.hookimpl
def pytest_runtest_setup(item):
    """为每个测试生成唯一ID"""
    import time
    pytest.current_test_id = str(int(time.time() * 1000))


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
