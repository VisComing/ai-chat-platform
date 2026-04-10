"""
Evaluate Middleware - 信息评估中间件

评估搜索结果的质量和完整性
"""
import logging
from typing import List, Dict, Any

from app.services.deer_flow.state import DeerFlowState
from app.services.deer_flow.middleware.base import ProgressMiddleware
from app.services.deep_research_graph import create_llm, parse_llm_json_response
from app.services.deep_research_prompts import EVALUATE_PROMPT, CURRENT_DATE
from app.services.search_service import search_service, SearchResult

logger = logging.getLogger(__name__)


class EvaluateMiddleware(ProgressMiddleware):
    """
    信息评估中间件

    从多个维度评估搜索结果：
    - 完整性：是否覆盖核心需求
    - 权威性：信息来源可靠性
    - 时效性：信息时间相关性
    - 多样性：观点和来源多样性
    """

    name = "evaluate"
    description = "评估搜索结果质量"

    async def process(self, state: DeerFlowState) -> DeerFlowState:
        """评估已在 SubAgent 中完成"""
        return state

    async def evaluate_results(
        self,
        topic: str,
        query: str,
        results: List[Dict[str, Any]],
        model: str
    ) -> Dict[str, Any]:
        """评估搜索结果"""
        if not results:
            return {
                "overall_score": 0,
                "is_sufficient": False,
                "scores": {
                    "completeness": 0,
                    "authority": 0,
                    "timeliness": 0,
                    "diversity": 0,
                },
                "weaknesses": ["未找到相关结果"],
            }

        llm = create_llm(model)
        formatted = search_service.format_results_for_llm(
            [SearchResult(**r) for r in results]
        )

        prompt = EVALUATE_PROMPT.format(
            current_topic=topic,
            search_query=query,
            search_results=formatted,
            current_date=CURRENT_DATE
        )

        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        return parse_llm_json_response(response.content)