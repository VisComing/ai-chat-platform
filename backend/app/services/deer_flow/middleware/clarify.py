"""
Clarify Middleware - 范围澄清中间件

分析用户需求，判断是否需要进一步澄清
"""
import logging
from typing import Optional

from app.services.deer_flow.state import DeerFlowState, Phase
from app.services.deer_flow.middleware.base import ProgressMiddleware
from app.services.deep_research_graph import create_llm, parse_llm_json_response
from app.services.deep_research_prompts import CLARIFY_PROMPT
from app.core.config import settings

logger = logging.getLogger(__name__)


class ClarifyMiddleware(ProgressMiddleware):
    """
    范围澄清中间件

    分析研究需求是否足够明确：
    - 需求范围是否过于宽泛
    - 时间/地域/深度是否明确
    - 输出格式是否明确
    """

    name = "clarify"
    description = "分析研究需求，判断是否需要澄清"

    async def process(self, state: DeerFlowState) -> DeerFlowState:
        """执行澄清分析"""
        # 如果跳过澄清，直接进入规划阶段
        if state.get("skip_clarification") or not settings.deep_research_enable_clarification:
            state["needs_clarification"] = False
            state["phase"] = Phase.PLAN

            await self.report_progress("phase_completed", {
                "phase": "clarify",
                "message": "跳过澄清阶段"
            })
            return state

        await self.report_progress("phase_started", {
            "phase": "clarify",
            "message": "正在分析研究需求..."
        })

        # 调用 LLM 分析
        llm = create_llm(state["model"])
        prompt = CLARIFY_PROMPT.format(query=state["query"])
        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        result = parse_llm_json_response(response.content)

        state["needs_clarification"] = result.get("needs_clarification", False)

        if state["needs_clarification"]:
            state["clarification_questions"] = result.get("questions", [])
            await self.report_progress("clarification_request", {
                "questions": state["clarification_questions"],
                "message": "需要进一步澄清研究需求"
            })
        else:
            state["phase"] = Phase.PLAN
            await self.report_progress("phase_completed", {
                "phase": "clarify",
                "message": "需求已明确，开始规划"
            })

        return state