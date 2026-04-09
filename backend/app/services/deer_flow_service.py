"""
DeerFlow Service - 深度研究服务适配层

封装 DeerFlow Orchestrator，提供 SSE 流式接口
兼容现有 deep_research_service 接口
"""
import json
import logging
import time
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, List, Optional
import uuid

from app.core.config import get_settings
from app.services.deer_flow.orchestrator import AgentOrchestrator
from app.services.deer_flow.state import DeerFlowState, ExecutionMode, Phase

logger = logging.getLogger(__name__)
settings = get_settings()


class DeerFlowService:
    """
    DeerFlow 服务

    封装 Orchestrator，提供 SSE 流式输出能力
    保持与现有接口兼容
    """

    def __init__(self):
        self.settings = get_settings()

    async def research(
        self,
        query: str,
        model: Optional[str] = None,
        skip_clarification: bool = False,
        clarified_requirements: Optional[str] = None,
        execution_mode: str = "parallel",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        执行深度研究，返回 SSE 事件流

        Args:
            query: 用户原始问题
            model: 模型名称
            skip_clarification: 是否跳过澄清
            clarified_requirements: 已澄清的需求
            execution_mode: 执行模式 (parallel/sequential/mixed/ultra)

        Yields:
            SSE 事件字典
        """
        start_time = time.time()
        model = model or settings.deep_research_default_model
        task_id = str(uuid.uuid4())

        # 发送开始事件
        yield {
            "event": "research_start",
            "data": {
                "type": "research_start",
                "taskId": task_id,
                "query": query,
                "model": model,
                "executionMode": execution_mode,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }

        try:
            # 包装 Orchestrator 的执行过程，生成 SSE 事件
            async for event in self._run_with_events(
                task_id,
                query,
                model,
                execution_mode,
                skip_clarification,
                clarified_requirements,
            ):
                yield event

        except Exception as e:
            logger.error(f"[DeerFlow] Error: {e}")
            yield {
                "event": "error",
                "data": {
                    "type": "error",
                    "content": str(e),
                    "phase": "unknown",
                }
            }

    async def _run_with_events(
        self,
        task_id: str,
        query: str,
        model: str,
        execution_mode: str,
        skip_clarification: bool,
        clarified_requirements: Optional[str],
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        运行 Orchestrator 并生成 SSE 事件
        """
        start_time = time.time()

        # 转换执行模式
        mode = ExecutionMode(execution_mode) if execution_mode in ["parallel", "sequential", "mixed", "ultra"] else ExecutionMode.PARALLEL

        # 定义回调收集器
        events_collector: List[Dict[str, Any]] = []

        async def collect_events(event_type: str, data: Dict[str, Any]):
            events_collector.append({"event": event_type, "data": data})

        # 创建 Orchestrator 并执行研究
        orchestrator = AgentOrchestrator(progress_callback=collect_events)

        # 执行研究
        state = await orchestrator.run(
            task_id=task_id,
            user_id="anonymous",  # 用户 ID 在 API 层注入
            query=query,
            model=model,
            execution_mode=mode,
            skip_clarification=skip_clarification,
            clarified_requirements=clarified_requirements,
        )

        # 发送收集的事件
        for event in events_collector:
            yield event

        # 检查是否需要澄清
        if state.get("needs_clarification"):
            yield {
                "event": "clarification_request",
                "data": {
                    "type": "clarification_request",
                    "questions": state.get("clarification_questions", []),
                    "message": "为了提供更精准的研究报告，请回答以下问题：",
                }
            }
            yield self._phase_event("clarify", "waiting", "等待用户回复澄清问题...")
            return

        # 发送子 Agent 进度事件
        for i, result in enumerate(state.get("sub_agent_results", [])):
            yield {
                "event": "sub_agent_completed",
                "data": {
                    "type": "sub_agent_completed",
                    "subTaskId": result.get("sub_task_id"),
                    "topic": result.get("topic"),
                    "status": result.get("status"),
                    "score": result.get("final_score"),
                    "iterations": result.get("total_iterations"),
                    "agentIndex": i + 1,
                    "totalAgents": len(state.get("sub_agent_results", [])),
                }
            }

        # 发送完成事件
        yield {
            "event": "research_complete",
            "data": {
                "type": "research_complete",
                "report": state.get("report", ""),
                "citations": state.get("citations", [])[:15],
                "duration": time.time() - start_time,
                "stats": {
                    "totalTasks": len(state.get("sub_tasks", [])),
                    "totalIterations": state.get("total_iterations", 0),
                    "totalSearches": state.get("total_searches", 0),
                }
            }
        }

    def _phase_event(
        self,
        phase: str,
        status: str,
        message: str,
        progress: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """生成阶段事件"""
        return {
            "event": "research_phase",
            "data": {
                "type": "research_phase",
                "phase": phase,
                "status": status,
                "message": message,
                "progress": progress,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }

    async def clarify(
        self,
        query: str,
        clarified_answers: List[str],
        model: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        处理用户的澄清回复，继续研究流程
        """
        clarified_requirements = "\n".join([
            f"用户澄清：{answer}"
            for answer in clarified_answers
        ])

        async for event in self.research(
            query=query,
            model=model,
            skip_clarification=True,
            clarified_requirements=clarified_requirements,
        ):
            yield event


# 单例实例
deer_flow_service = DeerFlowService()