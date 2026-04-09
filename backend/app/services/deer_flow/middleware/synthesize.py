"""
Synthesize Middleware - 报告综合中间件

汇总研究结果，生成结构化报告
"""
import json
import logging
from typing import List, Dict, Any

from app.services.deer_flow.state import DeerFlowState, Phase
from app.services.deer_flow.middleware.base import ProgressMiddleware
from app.services.deep_research_graph import create_llm
from app.services.deep_research_prompts import SYNTHESIZE_PROMPT

logger = logging.getLogger(__name__)


class SynthesizeMiddleware(ProgressMiddleware):
    """
    报告综合中间件

    生成最终研究报告：
    - 按章节组织内容
    - 标注信息来源
    - 提供关键发现和建议
    """

    name = "synthesize"
    description = "综合研究结果，生成报告"

    async def process(self, state: DeerFlowState) -> DeerFlowState:
        """生成研究报告"""
        await self.report_progress("phase_started", {
            "phase": "synthesize",
            "message": "正在整合研究结果..."
        })

        llm = create_llm(state["model"])

        # 准备信息文本
        info_sections = self._prepare_info_sections(state)

        prompt = SYNTHESIZE_PROMPT.format(
            research_goal=state.get("research_goal", state["query"]),
            research_plan=json.dumps({
                "research_goal": state.get("research_goal"),
                "sub_tasks": state.get("sub_tasks"),
            }, ensure_ascii=False, indent=2),
            all_collected_info=info_sections,
        )

        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        state["report"] = response.content
        state["phase"] = Phase.COMPLETED

        await self.report_progress("phase_completed", {
            "phase": "synthesize",
            "message": "研究报告已生成"
        })

        await self.report_progress("research_complete", {
            "report": state["report"],
            "citations": state.get("citations", [])[:15],
        })

        return state

    def _prepare_info_sections(self, state: DeerFlowState) -> str:
        """准备信息文本"""
        info_sections = []
        collected_info = state.get("collected_info", [])
        sub_tasks = state.get("sub_tasks", [])

        for task in sub_tasks:
            task_topic = task.get("topic", "")
            task_info = [i for i in collected_info if i.get("topic") == task_topic]
            if task_info:
                info_text = f"\n### {task_topic}\n"
                for info in task_info[:5]:
                    source = info.get("source", {})
                    info_text += f"- {source.get('title', '')}: {source.get('snippet', '')}\n"
                info_sections.append(info_text)

        return "\n".join(info_sections) if info_sections else "无收集信息"