"""
Tests for Deep Research Async Tasks API - MongoDB/Beanie Version
深度研究异步任务 API 测试
"""
import pytest
import pytest_asyncio
from datetime import datetime
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.database import init_db, close_db
from app.models import User
from app.models.research import ResearchTask, ResearchClarification, ResearchTaskStatus


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Setup database connection - runs for each test function"""
    await init_db()
    yield
    await close_db()


@pytest_asyncio.fixture
async def client():
    """Create test client"""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient):
    """Create authenticated user and return headers"""
    # Clean up any existing test user
    existing = await User.find_one(User.email == "test_research@example.com")
    if existing:
        await existing.delete()

    # Register user
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test_research@example.com",
            "username": "test_research_user",
            "password": "testpass123",
        },
    )

    assert response.status_code == 200
    data = response.json()

    return {"Authorization": f"Bearer {data['data']['accessToken']}"}


class TestResearchTaskAPI:
    """研究任务 API 测试"""

    @pytest.mark.asyncio
    async def test_create_task_success(self, client: AsyncClient, auth_headers):
        """测试成功创建任务"""
        response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={
                "query": "分析2024年AI行业发展趋势",
                "skipClarification": True
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "taskId" in data["data"]
        assert data["data"]["status"] == ResearchTaskStatus.PENDING.value

    @pytest.mark.asyncio
    async def test_get_task_status(self, client: AsyncClient, auth_headers):
        """测试获取任务状态"""
        # Create task first
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )
        task_id = create_response.json()["data"]["taskId"]

        # Query status
        response = await client.get(
            f"/api/v1/research/tasks/{task_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["taskId"] == task_id
        assert "status" in data["data"]
        assert "phase" in data["data"]

    @pytest.mark.asyncio
    async def test_get_task_not_found(self, client: AsyncClient, auth_headers):
        """测试查询不存在的任务"""
        response = await client.get(
            "/api/v1/research/tasks/non-existent-id",
            headers=auth_headers
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cancel_task(self, client: AsyncClient, auth_headers):
        """测试取消任务"""
        # Create task
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )
        task_id = create_response.json()["data"]["taskId"]

        # Cancel task
        response = await client.delete(
            f"/api/v1/research/tasks/{task_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["status"] == ResearchTaskStatus.CANCELLED.value

    @pytest.mark.asyncio
    async def test_list_tasks(self, client: AsyncClient, auth_headers):
        """测试获取任务列表"""
        # Create several tasks
        for i in range(3):
            await client.post(
                "/api/v1/research/tasks",
                headers=auth_headers,
                json={"query": f"测试问题 {i}"}
            )

        # Get list
        response = await client.get(
            "/api/v1/research/tasks?limit=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) >= 3


class TestClarificationFlow:
    """澄清流程测试"""

    @pytest.mark.asyncio
    async def test_submit_clarification_not_paused(self, client: AsyncClient, auth_headers):
        """测试对非暂停状态的任务提交澄清"""
        # Create task
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题", "skipClarification": True}
        )
        task_id = create_response.json()["data"]["taskId"]

        # Try to submit clarification (task not in paused state)
        response = await client.post(
            f"/api/v1/research/tasks/{task_id}/clarify",
            headers=auth_headers,
            json={"answers": ["回答1", "回答2"]}
        )

        assert response.status_code == 400
        assert "TASK_NOT_PAUSED" in response.json()["detail"]["code"]


class TestTaskResult:
    """任务结果测试"""

    @pytest.mark.asyncio
    async def test_get_result_not_completed(self, client: AsyncClient, auth_headers):
        """测试获取未完成任务的结果"""
        # Create task
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )
        task_id = create_response.json()["data"]["taskId"]

        # Try to get result (task not completed)
        response = await client.get(
            f"/api/v1/research/tasks/{task_id}/result",
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "TASK_NOT_COMPLETED" in response.json()["detail"]["code"]

    @pytest.mark.asyncio
    async def test_get_result_completed(self, client: AsyncClient, auth_headers):
        """测试获取已完成任务的结果"""
        # Create task
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )
        task_id = create_response.json()["data"]["taskId"]

        # Manually update task status to completed
        task = await ResearchTask.find_one(ResearchTask.id == task_id)
        task.status = ResearchTaskStatus.COMPLETED.value
        task.result_url = "research/test/report.md"
        task.report_preview = "这是报告摘要"
        await task.save()

        # Get result
        response = await client.get(
            f"/api/v1/research/tasks/{task_id}/result",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["reportUrl"] is not None