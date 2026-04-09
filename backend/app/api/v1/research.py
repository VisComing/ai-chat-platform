"""
Deep Research API Endpoint

支持 DeerFlow 架构的深度研究 API
"""
import json
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.services.deer_flow_service import deer_flow_service

router = APIRouter()
logger = logging.getLogger(__name__)


class ResearchRequest(BaseModel):
    """深度研究请求"""
    query: str  # 用户原始问题
    model: Optional[str] = None  # 模型名称
    sessionId: Optional[str] = None  # 会话ID（可选）
    skipClarification: bool = False  # 是否跳过澄清
    clarifiedRequirements: Optional[str] = None  # 已澄清的需求
    executionMode: Optional[str] = "parallel"  # 执行模式: parallel/sequential/mixed/ultra


class ClarifyRequest(BaseModel):
    """澄清回复请求"""
    query: str  # 用户原始问题
    answers: List[str]  # 用户对澄清问题的回答
    model: Optional[str] = None


@router.post("/stream")
async def research_stream(
    request: ResearchRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    深度研究 SSE 流式接口

    执行完整的四阶段研究工作流（DeerFlow 架构）：
    - 范围澄清（可选）
    - 研究规划
    - 并行子 Agent 执行
    - 综合报告

    SSE Events:
    - research_start: 研究开始
    - research_phase: 阶段状态更新
    - clarification_request: 需要用户澄清（可选）
    - research_plan: 研究计划
    - sub_agent_started: 子 Agent 开始（新增）
    - sub_agent_completed: 子 Agent 完成（新增）
    - research_complete: 研究完成，包含报告
    - error: 错误
    """
    logger.info(f"[DeerFlow] User {user_id} starting research: {request.query[:50]}...")
    logger.info(f"[DeerFlow] Execution mode: {request.executionMode}")

    async def event_generator():
        async for event in deer_flow_service.research(
            query=request.query,
            model=request.model,
            skip_clarification=request.skipClarification,
            clarified_requirements=request.clarifiedRequirements,
            execution_mode=request.executionMode or "parallel",
        ):
            # SSE 格式
            yield {
                "event": event.get("event", "message"),
                "data": json.dumps(event.get("data", {}), ensure_ascii=False),
            }

    return EventSourceResponse(event_generator())


@router.post("/clarify")
async def research_clarify(
    request: ClarifyRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    处理用户澄清回复，继续研究流程

    当收到 clarification_request 事件后，用户通过此端点提交澄清回复

    SSE Events:
    - 继续后续的研究流程事件
    """
    logger.info(f"[DeerFlow] User {user_id} submitted clarification: {len(request.answers)} answers")

    async def event_generator():
        async for event in deer_flow_service.clarify(
            query=request.query,
            clarified_answers=request.answers,
            model=request.model,
        ):
            yield {
                "event": event.get("event", "message"),
                "data": json.dumps(event.get("data", {}), ensure_ascii=False),
            }

    return EventSourceResponse(event_generator())


@router.get("/status")
async def get_research_status():
    """获取深度研究功能状态"""
    return {
        "success": True,
        "data": {
            "enabled": True,
            "architecture": "DeerFlow",
            "defaultExecutionMode": "parallel",
            "supportedModes": ["parallel", "sequential", "mixed", "ultra"],
            "maxIterations": 5,
            "targetScore": 0.8,
            "supportedModels": [
                "qwen3-max-2026-01-23",
                "qwen3.5-plus",
                "glm-5",
            ],
        }
    }