"""
Tests for Research Task Models
研究任务数据模型测试
"""
import pytest
from datetime import datetime

from app.models.research import (
    ResearchTask,
    ResearchClarification,
    UserResearchQuota,
    ResearchTaskStatus,
    ResearchPhase,
)


class TestResearchTaskModel:
    """研究任务模型测试"""

    def test_create_task(self):
        """测试创建任务"""
        task = ResearchTask(
            user_id="user-123",
            query="测试研究问题",
            model="qwen3-max-2026-01-23",
            status=ResearchTaskStatus.PENDING.value,
            phase=ResearchPhase.CLARIFY.value,
            progress={},
            total_iterations=0,
            total_searches=0,
        )

        assert task.status == ResearchTaskStatus.PENDING.value
        assert task.phase == ResearchPhase.CLARIFY.value
        assert task.progress == {}
        assert task.total_iterations == 0
        assert task.total_searches == 0

    def test_task_status_enum(self):
        """测试状态枚举"""
        assert ResearchTaskStatus.PENDING.value == "pending"
        assert ResearchTaskStatus.RUNNING.value == "running"
        assert ResearchTaskStatus.PAUSED.value == "paused"
        assert ResearchTaskStatus.COMPLETED.value == "completed"
        assert ResearchTaskStatus.FAILED.value == "failed"
        assert ResearchTaskStatus.CANCELLED.value == "cancelled"

    def test_task_phase_enum(self):
        """测试阶段枚举"""
        assert ResearchPhase.CLARIFY.value == "clarify"
        assert ResearchPhase.PLAN.value == "plan"
        assert ResearchPhase.RESEARCH.value == "research"
        assert ResearchPhase.SYNTHESIZE.value == "synthesize"


class TestResearchClarificationModel:
    """研究澄清模型测试"""

    def test_create_clarification(self):
        """测试创建澄清问题"""
        clarification = ResearchClarification(
            task_id="task-123",
            questions=["问题1", "问题2", "问题3"],
        )

        assert clarification.questions == ["问题1", "问题2", "问题3"]
        assert clarification.answers is None
        assert clarification.answered_at is None

    def test_answer_clarification(self):
        """测试回答澄清问题"""
        clarification = ResearchClarification(
            task_id="task-123",
            questions=["问题1"],
            answers=["回答1"],
            answered_at=datetime.utcnow(),
        )

        assert clarification.answers == ["回答1"]
        assert clarification.answered_at is not None


class TestUserResearchQuotaModel:
    """用户配额模型测试"""

    def test_create_quota(self):
        """测试创建配额"""
        quota = UserResearchQuota(
            user_id="user-123",
            daily_limit=5,
            daily_used=0,
            total_tasks=0,
        )

        assert quota.daily_limit == 5
        assert quota.daily_used == 0
        assert quota.total_tasks == 0

    def test_quota_usage(self):
        """测试配额使用"""
        quota = UserResearchQuota(
            user_id="user-123",
            daily_limit=5,
            daily_used=3,
        )

        remaining = quota.daily_limit - quota.daily_used
        assert remaining == 2
        assert quota.daily_used < quota.daily_limit