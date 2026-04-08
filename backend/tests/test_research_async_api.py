"""
Tests for Deep Research Async Tasks API
深度研究异步任务 API 测试
"""
import pytest
import pytest_asyncio
from datetime import datetime, date
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.models import User
from app.models.research import ResearchTask, ResearchClarification, UserResearchQuota, ResearchTaskStatus


# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_research.db"


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
            "email": "test_research@example.com",
            "username": "testuser",
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
    async def test_create_task_quota_exceeded(self, client: AsyncClient, auth_headers, test_db):
        """测试配额超限"""
        # 先获取用户 ID
        async with test_db() as db:
            result = await db.execute(select(User).where(User.username == "testuser"))
            user = result.scalar_one()
            user_id = user.id

            # 设置配额为已用完
            quota = UserResearchQuota(
                user_id=user_id,
                daily_limit=5,
                daily_used=5,
                last_reset_date=datetime.utcnow()
            )
            db.add(quota)
            await db.commit()

        # 尝试创建任务
        response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )

        assert response.status_code == 429
        data = response.json()
        assert "QUOTA_EXCEEDED" in data["detail"]["code"]

    @pytest.mark.asyncio
    async def test_get_task_status(self, client: AsyncClient, auth_headers):
        """测试获取任务状态"""
        # 先创建任务
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )
        task_id = create_response.json()["data"]["taskId"]

        # 查询状态
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
        # 创建任务
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )
        task_id = create_response.json()["data"]["taskId"]

        # 取消任务
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
        # 创建几个任务
        for i in range(3):
            await client.post(
                "/api/v1/research/tasks",
                headers=auth_headers,
                json={"query": f"测试问题 {i}"}
            )

        # 获取列表
        response = await client.get(
            "/api/v1/research/tasks?limit=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) >= 3

    @pytest.mark.asyncio
    async def test_get_quota_status(self, client: AsyncClient, auth_headers):
        """测试获取配额状态"""
        response = await client.get(
            "/api/v1/research/quota",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "dailyLimit" in data["data"]
        assert "dailyUsed" in data["data"]
        assert "dailyRemaining" in data["data"]


class TestClarificationFlow:
    """澄清流程测试"""

    @pytest.mark.asyncio
    async def test_submit_clarification_not_paused(self, client: AsyncClient, auth_headers):
        """测试对非暂停状态的任务提交澄清"""
        # 创建任务
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题", "skipClarification": True}
        )
        task_id = create_response.json()["data"]["taskId"]

        # 尝试提交澄清（任务不在暂停状态）
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
        # 创建任务
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )
        task_id = create_response.json()["data"]["taskId"]

        # 尝试获取结果（任务未完成）
        response = await client.get(
            f"/api/v1/research/tasks/{task_id}/result",
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "TASK_NOT_COMPLETED" in response.json()["detail"]["code"]

    @pytest.mark.asyncio
    async def test_get_result_completed(self, client: AsyncClient, auth_headers, test_db):
        """测试获取已完成任务的结果"""
        # 创建任务
        create_response = await client.post(
            "/api/v1/research/tasks",
            headers=auth_headers,
            json={"query": "测试问题"}
        )
        task_id = create_response.json()["data"]["taskId"]

        # 手动更新任务状态为已完成
        async with test_db() as db:
            result = await db.execute(
                select(ResearchTask).where(ResearchTask.id == task_id)
            )
            task = result.scalar_one()
            task.status = ResearchTaskStatus.COMPLETED.value
            task.result_url = "research/test/report.md"
            task.report_preview = "这是报告摘要"
            await db.commit()

        # 获取结果
        response = await client.get(
            f"/api/v1/research/tasks/{task_id}/result",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["reportUrl"] is not None


class TestQuotaReset:
    """配额重置测试"""

    @pytest.mark.asyncio
    async def test_quota_daily_reset(self, client: AsyncClient, auth_headers, test_db):
        """测试每日配额重置"""
        # 获取用户 ID
        async with test_db() as db:
            result = await db.execute(select(User).where(User.username == "testuser"))
            user = result.scalar_one()
            user_id = user.id

            # 设置昨天的重置日期
            quota = UserResearchQuota(
                user_id=user_id,
                daily_limit=5,
                daily_used=5,
                last_reset_date=datetime(2020, 1, 1)  # 过去的日期
            )
            db.add(quota)
            await db.commit()

        # 查询配额（应该自动重置）
        response = await client.get(
            "/api/v1/research/quota",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["dailyUsed"] == 0  # 应该已重置
        assert data["data"]["dailyRemaining"] == data["data"]["dailyLimit"]