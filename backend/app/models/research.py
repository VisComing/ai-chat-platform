"""
Deep Research Models - MongoDB Beanie Documents
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import Field, field_validator
from beanie import Document, Indexed
from bson import ObjectId
import uuid
import enum


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


class ResearchTaskStatus(str, enum.Enum):
    """研究任务状态"""
    PENDING = "pending"      # 等待执行
    RUNNING = "running"      # 正在执行
    PAUSED = "paused"        # 暂停（等待用户澄清）
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"        # 执行失败
    CANCELLED = "cancelled"  # 已取消


class ResearchPhase(str, enum.Enum):
    """研究阶段"""
    CLARIFY = "clarify"      # 范围澄清
    PLAN = "plan"            # 研究规划
    RESEARCH = "research"    # 迭代搜索
    SYNTHESIZE = "synthesize"  # 综合报告


class ResearchTask(Document):
    """深度研究任务模型"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    user_id: Indexed(str)
    session_id: Optional[str] = None

    # 基本信息
    query: str
    clarified_requirements: Optional[str] = None
    model: str = "qwen3-max-2026-01-23"

    # 状态
    status: str = ResearchTaskStatus.PENDING.value

    # 进度
    phase: str = ResearchPhase.CLARIFY.value
    phase_status: str = "started"
    phase_message: Optional[str] = None
    progress: Optional[Dict[str, Any]] = Field(default_factory=dict)
    # progress 结构: {"current_task": 2, "total_tasks": 5, "iteration": 3, ...}
    sub_tasks: Optional[Dict[str, Any]] = None  # 子任务列表和状态

    # 结果
    result_url: Optional[str] = None  # 报告文件路径
    report_preview: Optional[str] = None  # 报告摘要
    citations: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

    # 统计
    total_iterations: int = 0
    total_searches: int = 0
    token_usage: int = 0

    # 错误信息
    error_message: Optional[str] = None
    error_phase: Optional[str] = None

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "research_tasks"
        indexes = [
            "user_id",
            "status",
            "created_at",
        ]

    class Config:
        populate_by_name = True


class ResearchClarification(Document):
    """研究澄清问题模型"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    task_id: Indexed(str)

    questions: Dict[str, Any]  # List[str]: ["问题1", "问题2"]
    answers: Optional[Dict[str, Any]] = None  # Optional[List[str]]: 用户回复后填写

    created_at: datetime = Field(default_factory=datetime.utcnow)
    answered_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "research_clarifications"
        indexes = ["task_id"]

    class Config:
        populate_by_name = True


class UserResearchQuota(Document):
    """用户研究配额模型"""

    id: str = Field(default_factory=generate_uuid, alias="_id")
    user_id: Indexed(str, unique=True)  # Primary key equivalent

    daily_limit: int = 5  # 每日限制次数
    daily_used: int = 0   # 今日已使用次数
    last_reset_date: datetime = Field(default_factory=datetime.utcnow)  # 上次重置日期
    total_tasks: int = 0  # 总任务数

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "user_research_quota"
        indexes = ["user_id"]

    class Config:
        populate_by_name = True


# Export all models
__all__ = [
    "ResearchTask",
    "ResearchClarification",
    "UserResearchQuota",
    "ResearchTaskStatus",
    "ResearchPhase",
    "generate_uuid",
]