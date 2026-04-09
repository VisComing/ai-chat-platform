"""
Plan Middleware - 任务规划中间件

将研究目标拆解为可执行的子任务
"""
import json
import logging
import uuid
from typing import Optional

from app.services.deer_flow.state import DeerFlowState, Phase
from app.services.deer_flow.middleware.base import ProgressMiddleware
from app.services.deep_research_graph import create_llm, parse_llm_json_response
from app.services.deep_research_prompts import PLAN_PROMPT
from app.core.config import settings

logger = logging.getLogger(__name__)


class PlanMiddleware(ProgressMiddleware):
    """
    任务规划中间件

    将研究目标拆解为可执行的子任务：
    - 每个子任务聚焦一个主题
    - 包含搜索关键词和策略
    - 设置优先级和迭代上限
    """

    name = "plan"
    description = "制定研究计划，拆解子任务"

    async def process(self, state: DeerFlowState) -> DeerFlowState:
        """执行任务规划"""
        await self.report_progress("phase_started", {
            "phase": "plan",
            "message": "正在制定研究计划..."
        })

        llm = create_llm(state["model"])

        # 准备澄清需求部分
        requirements_section = ""
        clarified = state.get("clarified_requirements")
        if clarified:
            requirements_section = f"澄清后的需求：{clarified}"

        prompt = PLAN_PROMPT.format(
            query=state["query"],
            clarified_requirements=requirements_section
        )

        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        result = parse_llm_json_response(response.content)

        # 处理子任务，添加 ID 和默认值
        sub_tasks = result.get("sub_tasks", [])
        for task in sub_tasks:
            task["id"] = str(uuid.uuid4())
            task["max_iterations"] = settings.deep_research_max_iterations
            task["target_score"] = settings.deep_research_target_score

        state["research_goal"] = result.get("research_goal", state["query"])
        state["sub_tasks"] = sub_tasks
        state["expected_sections"] = result.get("expected_sections", [])
        state["phase"] = Phase.RESEARCH

        await self.report_progress("research_plan", {
            "goal": state["research_goal"],
            "subTasks": state["sub_tasks"],
            "totalTasks": len(sub_tasks),
        })

        await self.report_progress("phase_completed", {
            "phase": "plan",
            "message": f"已规划 {len(sub_tasks)} 个研究子任务"
        })

        return state