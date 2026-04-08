"""
Tests for Research Graph Checkpoint
研究工作流检查点测试
"""
import pytest
import json
from datetime import datetime

from sqlalchemy import text

from app.services.research_graph_checkpoint import (
    ResearchGraphCheckpoint,
    ResearchState,
    ResearchGraphWithCheckpoint,
    checkpoint_manager,
)
from app.core.database import async_session_maker


@pytest.fixture
async def init_checkpoint_table():
    """初始化检查点表"""
    async with async_session_maker() as session:
        await session.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {ResearchGraphCheckpoint.CHECKPOINT_TABLE} (
                task_id VARCHAR(36) PRIMARY KEY,
                state TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        await session.commit()


class TestResearchGraphCheckpoint:
    """检查点管理器测试"""

    @pytest.mark.asyncio
    async def test_save_and_load_checkpoint(self, init_checkpoint_table):
        """测试保存和加载检查点"""
        task_id = "test-task-checkpoint-1"
        state: ResearchState = {
            "task_id": task_id,
            "user_id": "user-123",
            "query": "测试问题",
            "model": "qwen3-max",
            "phase": "research",
            "current_task_index": 2,
            "current_iteration": 1,
            "collected_info": [{"test": "info"}],
            "citations": [],
            "total_searches": 5,
            "total_iterations": 3,
        }

        # 保存
        await checkpoint_manager.save(task_id, state)

        # 加载
        loaded_state = await checkpoint_manager.load(task_id)

        assert loaded_state is not None
        assert loaded_state["task_id"] == task_id
        assert loaded_state["phase"] == "research"
        assert loaded_state["current_task_index"] == 2
        assert loaded_state["total_searches"] == 5

        # 清理
        await checkpoint_manager.delete(task_id)

    @pytest.mark.asyncio
    async def test_load_nonexistent_checkpoint(self, init_checkpoint_table):
        """测试加载不存在的检查点"""
        state = await checkpoint_manager.load("nonexistent-task-id")
        assert state is None

    @pytest.mark.asyncio
    async def test_update_checkpoint(self, init_checkpoint_table):
        """测试更新检查点"""
        task_id = "test-task-checkpoint-2"

        # 初始状态
        state1: ResearchState = {
            "task_id": task_id,
            "user_id": "user-123",
            "query": "测试问题",
            "model": "qwen3-max",
            "phase": "clarify",
        }
        await checkpoint_manager.save(task_id, state1)

        # 更新状态
        state2: ResearchState = {
            **state1,
            "phase": "plan",
            "research_goal": "研究目标",
            "sub_tasks": [{"topic": "子任务1"}],
        }
        await checkpoint_manager.save(task_id, state2)

        # 加载并验证
        loaded = await checkpoint_manager.load(task_id)
        assert loaded["phase"] == "plan"
        assert loaded["research_goal"] == "研究目标"
        assert len(loaded["sub_tasks"]) == 1

        # 清理
        await checkpoint_manager.delete(task_id)

    @pytest.mark.asyncio
    async def test_delete_checkpoint(self, init_checkpoint_table):
        """测试删除检查点"""
        task_id = "test-task-checkpoint-3"
        state: ResearchState = {
            "task_id": task_id,
            "user_id": "user-123",
            "query": "测试问题",
            "model": "qwen3-max",
            "phase": "research",
        }

        # 保存
        await checkpoint_manager.save(task_id, state)

        # 删除
        await checkpoint_manager.delete(task_id)

        # 验证已删除
        loaded = await checkpoint_manager.load(task_id)
        assert loaded is None


class TestResearchGraphWorkflow:
    """研究工作流测试"""

    def test_build_search_query(self):
        """测试构建搜索查询"""
        graph = ResearchGraphWithCheckpoint("test-task")

        # 第一次迭代，使用第一个关键词
        task = {"topic": "AI发展", "keywords": ["人工智能发展", "AI趋势", "机器学习"]}
        query = graph._build_search_query(task, 0)
        assert query == "人工智能发展"

        # 第二次迭代，使用第二个关键词
        query = graph._build_search_query(task, 1)
        assert query == "AI趋势"

        # 迭代次数超过关键词数量
        query = graph._build_search_query(task, 5)
        assert "人工智能发展" in query and "AI趋势" in query

    def test_build_search_query_no_keywords(self):
        """测试无关键词时构建搜索查询"""
        graph = ResearchGraphWithCheckpoint("test-task")

        task = {"topic": "AI发展", "keywords": []}
        query = graph._build_search_query(task, 0)
        assert query == "AI发展"

        query = graph._build_search_query(task, 1)
        assert "AI发展" in query


class TestResearchStateSerialization:
    """研究状态序列化测试"""

    def test_state_json_serialization(self):
        """测试状态可以 JSON 序列化"""
        state: ResearchState = {
            "task_id": "task-123",
            "user_id": "user-456",
            "query": "测试问题",
            "model": "qwen3-max",
            "phase": "research",
            "current_task_index": 0,
            "current_iteration": 0,
            "collected_info": [],
            "citations": [],
            "total_searches": 0,
            "total_iterations": 0,
            "sub_tasks": [
                {"topic": "子任务1", "keywords": ["关键词1"]}
            ],
        }

        # 应该可以序列化
        json_str = json.dumps(state, default=str)
        loaded = json.loads(json_str)

        assert loaded["task_id"] == "task-123"
        assert loaded["phase"] == "research"
        assert len(loaded["sub_tasks"]) == 1

    def test_state_with_datetime(self):
        """测试包含 datetime 的状态序列化"""
        state = {
            "task_id": "task-123",
            "created_at": datetime.utcnow(),
        }

        # 使用 default=str 处理 datetime
        json_str = json.dumps(state, default=str)
        loaded = json.loads(json_str)

        assert "created_at" in loaded
        assert isinstance(loaded["created_at"], str)