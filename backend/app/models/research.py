"""
Deep Research Models - 深度研究任务数据模型
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, Integer, DateTime, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


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


class ResearchTask(Base):
    """深度研究任务模型"""
    __tablename__ = "research_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("sessions.id"))

    # 基本信息
    query: Mapped[str] = mapped_column(Text, nullable=False)
    clarified_requirements: Mapped[Optional[str]] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(50), default="qwen3-max-2026-01-23")

    # 状态
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ResearchTaskStatus.PENDING.value
    )

    # 进度
    phase: Mapped[str] = mapped_column(String(20), default=ResearchPhase.CLARIFY.value)
    phase_status: Mapped[str] = mapped_column(String(20), default="started")
    phase_message: Mapped[Optional[str]] = mapped_column(Text)
    progress: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    # progress 结构: {"current_task": 2, "total_tasks": 5, "iteration": 3, ...}
    sub_tasks: Mapped[Optional[dict]] = mapped_column(JSON)  # 子任务列表和状态

    # 结果
    result_url: Mapped[Optional[str]] = mapped_column(String(500))  # 报告文件路径
    report_preview: Mapped[Optional[str]] = mapped_column(Text)  # 报告摘要
    citations: Mapped[Optional[dict]] = mapped_column(JSON, default=list)

    # 统计
    total_iterations: Mapped[int] = mapped_column(Integer, default=0)
    total_searches: Mapped[int] = mapped_column(Integer, default=0)
    token_usage: Mapped[int] = mapped_column(Integer, default=0)

    # 错误信息
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    error_phase: Mapped[Optional[str]] = mapped_column(String(20))

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    clarifications: Mapped[List["ResearchClarification"]] = relationship(
        "ResearchClarification",
        back_populates="task",
        cascade="all, delete-orphan"
    )


class ResearchClarification(Base):
    """研究澄清问题模型"""
    __tablename__ = "research_clarifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_tasks.id"), nullable=False, index=True)

    questions: Mapped[dict] = mapped_column(JSON, nullable=False)  # List[str]: ["问题1", "问题2"]
    answers: Mapped[Optional[dict]] = mapped_column(JSON)  # Optional[List[str]]: 用户回复后填写

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    answered_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    task: Mapped["ResearchTask"] = relationship("ResearchTask", back_populates="clarifications")


class UserResearchQuota(Base):
    """用户研究配额模型"""
    __tablename__ = "user_research_quota"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        primary_key=True
    )

    daily_limit: Mapped[int] = mapped_column(Integer, default=5)  # 每日限制次数
    daily_used: Mapped[int] = mapped_column(Integer, default=0)   # 今日已使用次数
    last_reset_date: Mapped[datetime] = mapped_column(DateTime, default=func.now())  # 上次重置日期
    total_tasks: Mapped[int] = mapped_column(Integer, default=0)  # 总任务数

    # Relationships
    user: Mapped["User"] = relationship("User")