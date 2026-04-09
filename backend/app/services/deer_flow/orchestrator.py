"""
DeerFlow Orchestrator - 主 Agent 调度器

负责任务调度和结果汇总，支持并行/顺序执行模式
"""
import asyncio
import json
import logging
import time
import uuid
from typing import Dict, Any, List, Optional, Callable

from app.services.deer_flow.state import (
    DeerFlowState,
    SubTaskConfig,
    AgentResult,
    ExecutionMode,
    Phase,
    create_initial_state,
    update_phase,
    merge_agent_results,
)
from app.services.deer_flow.sub_agent import (
    run_sub_agents_parallel,
    run_sub_agents_sequential,
)
from app.services.deep_research_graph import create_llm, parse_llm_json_response
from app.services.deep_research_prompts import (
    CLARIFY_PROMPT,
    PLAN_PROMPT,
    SYNTHESIZE_PROMPT,
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """
    主 Agent - 任务调度和结果汇总

    核心职责：
    1. 接收用户任务，解析意图
    2. 决定执行模式
    3. 派发子 Agent 任务
    4. 汇总子 Agent 结果
    """

    SUPPORTED_MODES = ["parallel", "sequential", "mixed", "ultra"]

    def __init__(self, progress_callback: Optional[Callable] = None):
        self.progress_callback = progress_callback

    async def run(
        self,
        task_id: str,
        user_id: str,
        query: str,
        model: Optional[str] = None,
        execution_mode: ExecutionMode = ExecutionMode.PARALLEL,
        skip_clarification: bool = False,
        clarified_requirements: Optional[str] = None,
    ) -> DeerFlowState:
        """
        执行完整的研究工作流

        Args:
            task_id: 任务 ID
            user_id: 用户 ID
            query: 用户原始问题
            model: 模型名称
            execution_mode: 执行模式（默认并行）
            skip_clarification: 是否跳过澄清
            clarified_requirements: 已澄清的需求

        Returns:
            最终状态
        """
        start_time = time.time()
        model = model or settings.deep_research_default_model

        # 创建初始状态
        state = create_initial_state(
            task_id=task_id,
            user_id=user_id,
            query=query,
            model=model,
            execution_mode=execution_mode,
        )

        try:
            # === Phase 1: Clarify ===
            state = await self._run_clarify(
                state, skip_clarification, clarified_requirements
            )

            if state.get("needs_clarification"):
                # 需要用户澄清，暂停
                if self.progress_callback:
                    await self.progress_callback(
                        "clarification_request",
                        {
                            "questions": state.get("clarification_questions", []),
                        }
                    )
                return state

            # === Phase 2: Plan ===
            state = await self._run_plan(state, clarified_requirements)

            # 发送计划事件
            if self.progress_callback:
                await self.progress_callback(
                    "research_plan",
                    {
                        "goal": state.get("research_goal", query),
                        "subTasks": state.get("sub_tasks", []),
                    }
                )

            # === Phase 3: Research (Dispatch Sub-Agents) ===
            state = await self._dispatch_sub_agents(state)

            # === Phase 4: Synthesize ===
            state = await self._run_synthesize(state)

            # 完成
            state = update_phase(state, Phase.COMPLETED)
            state["total_duration_ms"] = int((time.time() - start_time) * 1000)

            logger.info(
                f"[Orchestrator] Task completed: "
                f"duration={state['total_duration_ms']}ms, "
                f"iterations={state['total_iterations']}"
            )

            return state

        except Exception as e:
            logger.error(f"[Orchestrator] Error: {e}")
            state = update_phase(state, Phase.FAILED)
            state["error"] = str(e)
            state["total_duration_ms"] = int((time.time() - start_time) * 1000)
            return state

    async def _run_clarify(
        self,
        state: DeerFlowState,
        skip_clarification: bool,
        clarified_requirements: Optional[str],
    ) -> DeerFlowState:
        """执行澄清阶段"""
        if self.progress_callback:
            await self.progress_callback("phase_started", {"phase": "clarify"})

        if skip_clarification or not settings.deep_research_enable_clarification:
            state["needs_clarification"] = False
            state = update_phase(state, Phase.PLAN)

            if clarified_requirements:
                state["clarified_requirements"] = clarified_requirements

            if self.progress_callback:
                await self.progress_callback(
                    "phase_completed",
                    {"phase": "clarify", "message": "跳过澄清"}
                )
            return state

        # 调用 LLM 分析是否需要澄清
        llm = create_llm(state["model"])
        prompt = CLARIFY_PROMPT.format(query=state["query"])
        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        result = parse_llm_json_response(response.content)

        state["needs_clarification"] = result.get("needs_clarification", False)

        if state["needs_clarification"]:
            state["clarification_questions"] = result.get("questions", [])
            if self.progress_callback:
                await self.progress_callback(
                    "phase_waiting",
                    {"phase": "clarify", "message": "等待用户澄清"}
                )
        else:
            state = update_phase(state, Phase.PLAN)
            if self.progress_callback:
                await self.progress_callback(
                    "phase_completed",
                    {"phase": "clarify", "message": "需求已明确"}
                )

        return state

    async def _run_plan(
        self,
        state: DeerFlowState,
        clarified_requirements: Optional[str],
    ) -> DeerFlowState:
        """执行规划阶段"""
        if self.progress_callback:
            await self.progress_callback("phase_started", {"phase": "plan"})

        llm = create_llm(state["model"])

        requirements_section = ""
        if clarified_requirements:
            state["clarified_requirements"] = clarified_requirements
            requirements_section = f"澄清后的需求：{clarified_requirements}"
        elif state.get("clarified_requirements"):
            requirements_section = f"澄清后的需求：{state['clarified_requirements']}"

        prompt = PLAN_PROMPT.format(
            query=state["query"],
            clarified_requirements=requirements_section
        )

        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        result = parse_llm_json_response(response.content)

        # 添加 ID 和默认值到子任务
        sub_tasks = result.get("sub_tasks", [])
        for i, task in enumerate(sub_tasks):
            task["id"] = str(uuid.uuid4())
            task["max_iterations"] = settings.deep_research_max_iterations
            task["target_score"] = settings.deep_research_target_score

        state["research_goal"] = result.get("research_goal", state["query"])
        state["sub_tasks"] = sub_tasks
        state["expected_sections"] = result.get("expected_sections", [])
        state = update_phase(state, Phase.RESEARCH)

        if self.progress_callback:
            await self.progress_callback(
                "phase_completed",
                {"phase": "plan", "message": f"已规划 {len(sub_tasks)} 个子任务"}
            )

        return state

    async def _dispatch_sub_agents(self, state: DeerFlowState) -> DeerFlowState:
        """
        派发子 Agent 执行研究任务

        根据执行模式选择并行或顺序执行
        """
        sub_tasks = state.get("sub_tasks", [])
        if not sub_tasks:
            state = update_phase(state, Phase.SYNTHESIZE)
            return state

        mode = state.get("execution_mode", ExecutionMode.PARALLEL)

        if self.progress_callback:
            await self.progress_callback(
                "phase_started",
                {
                    "phase": "research",
                    "mode": mode,
                    "total_tasks": len(sub_tasks),
                }
            )

        # 根据模式选择执行方式
        if mode == ExecutionMode.PARALLEL:
            # 并行执行
            logger.info(f"[Orchestrator] Running {len(sub_tasks)} agents in parallel")
            results = await run_sub_agents_parallel(
                configs=sub_tasks,
                model=state["model"],
                progress_callback=self.progress_callback,
            )
        elif mode == ExecutionMode.ULTRA:
            # Ultra 模式：全并行 + 最大迭代
            logger.info(f"[Orchestrator] Running in ULTRA mode")
            # 增加迭代上限
            for task in sub_tasks:
                task["max_iterations"] = settings.deep_research_max_iterations * 2
            results = await run_sub_agents_parallel(
                configs=sub_tasks,
                model=state["model"],
                progress_callback=self.progress_callback,
            )
        else:
            # 顺序执行
            logger.info(f"[Orchestrator] Running {len(sub_tasks)} agents sequentially")
            results = await run_sub_agents_sequential(
                configs=sub_tasks,
                model=state["model"],
                progress_callback=self.progress_callback,
            )

        # 存储结果
        state["sub_agent_results"] = results

        # 合并所有 Agent 的结果
        state = merge_agent_results(state)

        # 统计
        state["total_iterations"] = sum(
            r.get("total_iterations", 0) for r in results
        )
        state["total_searches"] = sum(
            len(r.get("collected_info", [])) for r in results
        )

        state = update_phase(state, Phase.SYNTHESIZE)

        if self.progress_callback:
            await self.progress_callback(
                "phase_completed",
                {
                    "phase": "research",
                    "message": f"完成 {len(results)} 个子任务",
                    "total_iterations": state["total_iterations"],
                }
            )

        return state

    async def _run_synthesize(self, state: DeerFlowState) -> DeerFlowState:
        """执行综合阶段 - 生成最终报告"""
        if self.progress_callback:
            await self.progress_callback("phase_started", {"phase": "synthesize"})

        llm = create_llm(state["model"])

        # 准备信息文本
        info_sections = []
        for task in state.get("sub_tasks", []):
            task_topic = task.get("topic", "")
            task_info = [
                i for i in state.get("collected_info", [])
                if i.get("topic") == task_topic
            ]
            if task_info:
                info_text = f"\n### {task_topic}\n"
                for info in task_info[:5]:
                    source = info.get("source", {})
                    info_text += f"- {source.get('title', '')}: {source.get('snippet', '')}\n"
                info_sections.append(info_text)

        all_info_text = "\n".join(info_sections) if info_sections else "无收集信息"

        prompt = SYNTHESIZE_PROMPT.format(
            research_goal=state.get("research_goal", state["query"]),
            research_plan=json.dumps({
                "research_goal": state.get("research_goal"),
                "sub_tasks": state.get("sub_tasks"),
            }, ensure_ascii=False, indent=2),
            all_collected_info=all_info_text,
        )

        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        state["report"] = response.content

        if self.progress_callback:
            await self.progress_callback(
                "phase_completed",
                {"phase": "synthesize", "message": "报告已生成"}
            )
            # 发送最终报告
            await self.progress_callback(
                "research_complete",
                {
                    "report": state["report"],
                    "citations": state.get("citations", [])[:15],
                    "duration": state.get("total_duration_ms", 0) / 1000,
                }
            )

        return state


# 单例工厂
def create_orchestrator(
    progress_callback: Optional[Callable] = None
) -> AgentOrchestrator:
    """创建 Orchestrator 实例"""
    return AgentOrchestrator(progress_callback)