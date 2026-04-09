"""
DeerFlow SubAgent - 子 Agent 实现

执行单个研究子任务，包含独立上下文和工具集
"""
import asyncio
import logging
import time
import uuid
from typing import Dict, Any, List, Optional, Callable

from app.services.deer_flow.state import (
    SubTaskConfig,
    AgentResult,
    SubTaskStatus,
)
from app.services.search_service import search_service
from app.services.deep_research_graph import create_llm, parse_llm_json_response
from app.services.deep_research_prompts import EVALUATE_PROMPT, CURRENT_DATE
from app.core.config import settings

logger = logging.getLogger(__name__)


class AgentContext:
    """子 Agent 独立上下文"""

    def __init__(self, sub_task_id: str):
        self.sub_task_id = sub_task_id
        self.iteration = 0
        self.collected_info: List[Dict[str, Any]] = []
        self.citations: List[Dict[str, Any]] = []
        self.search_queries: List[str] = []
        self.scores: List[float] = []

    def add_info(self, info: Dict[str, Any]) -> None:
        """添加收集的信息"""
        self.collected_info.append(info)

    def add_citation(self, citation: Dict[str, Any]) -> None:
        """添加引用"""
        self.citations.append(citation)

    def add_score(self, score: float) -> None:
        """添加评估分数"""
        self.scores.append(score)


class SubAgent:
    """
    子 Agent - 执行单个研究子任务

    职责：
    - 执行迭代搜索
    - 评估信息质量
    - 返回结构化结果
    """

    def __init__(
        self,
        config: SubTaskConfig,
        model: str,
        progress_callback: Optional[Callable] = None,
    ):
        self.config = config
        self.model = model
        self.context = AgentContext(config.get("id", str(uuid.uuid4())))
        self.progress_callback = progress_callback
        self._status = SubTaskStatus.PENDING

    @property
    def status(self) -> SubTaskStatus:
        return self._status

    async def execute(self) -> AgentResult:
        """
        执行子任务研究

        迭代搜索直到信息充足或达到最大迭代次数
        """
        start_time = time.time()
        self._status = SubTaskStatus.RUNNING

        topic = self.config.get("topic", "")
        keywords = self.config.get("keywords", [])
        max_iterations = self.config.get(
            "max_iterations", settings.deep_research_max_iterations
        )
        target_score = self.config.get(
            "target_score", settings.deep_research_target_score
        )

        logger.info(f"[SubAgent] Starting task: {topic}")

        try:
            # 迭代搜索
            while self.context.iteration < max_iterations:
                # 构建搜索查询
                query = self._build_search_query(keywords, topic, self.context.iteration)

                if self.progress_callback:
                    await self.progress_callback(
                        "sub_agent_progress",
                        {
                            "sub_task_id": self.context.sub_task_id,
                            "topic": topic,
                            "iteration": self.context.iteration + 1,
                            "max_iterations": max_iterations,
                            "query": query,
                        }
                    )

                # 执行搜索
                search_results = await self._execute_search(query)
                self.context.search_queries.append(query)

                # 收集信息
                for result in search_results:
                    self.context.add_info({
                        "topic": topic,
                        "query": query,
                        "source": result,
                    })
                    if result.get("link"):
                        self.context.add_citation({
                            "title": result.get("title", ""),
                            "link": result.get("link", ""),
                            "published_time": result.get("published_time", ""),
                            "snippet": result.get("snippet", ""),
                        })

                # 评估信息质量
                evaluation = await self._evaluate(topic, query, search_results)
                score = evaluation.get("overall_score", 0)
                self.context.add_score(score)

                logger.info(
                    f"[SubAgent] Iteration {self.context.iteration + 1}: "
                    f"score={score:.2f}, results={len(search_results)}"
                )

                if self.progress_callback:
                    await self.progress_callback(
                        "sub_agent_evaluation",
                        {
                            "sub_task_id": self.context.sub_task_id,
                            "topic": topic,
                            "score": score,
                            "is_sufficient": score >= target_score,
                        }
                    )

                # 判断是否充足
                if score >= target_score:
                    logger.info(f"[SubAgent] Task {topic} completed (score >= {target_score})")
                    break

                self.context.iteration += 1

            # 完成
            self._status = SubTaskStatus.COMPLETED
            duration_ms = int((time.time() - start_time) * 1000)

            final_score = max(self.context.scores) if self.context.scores else 0.0

            return AgentResult(
                sub_task_id=self.context.sub_task_id,
                topic=topic,
                status=self._status,
                collected_info=self.context.collected_info,
                citations=self.context.citations,
                total_iterations=self.context.iteration + 1,
                final_score=final_score,
                duration_ms=duration_ms,
            )

        except Exception as e:
            logger.error(f"[SubAgent] Error in task {topic}: {e}")
            self._status = SubTaskStatus.FAILED
            duration_ms = int((time.time() - start_time) * 1000)

            return AgentResult(
                sub_task_id=self.context.sub_task_id,
                topic=topic,
                status=self._status,
                collected_info=self.context.collected_info,
                citations=self.context.citations,
                total_iterations=self.context.iteration + 1,
                final_score=0.0,
                duration_ms=duration_ms,
                error=str(e),
            )

    def _build_search_query(
        self,
        keywords: List[str],
        topic: str,
        iteration: int
    ) -> str:
        """构建搜索查询"""
        if iteration == 0:
            return keywords[0] if keywords else topic
        else:
            if len(keywords) > iteration:
                return keywords[iteration]
            elif len(keywords) > 1:
                return " ".join(keywords[:2])
            else:
                return f"{topic} 详细分析"

    async def _execute_search(self, query: str) -> List[Dict[str, Any]]:
        """执行搜索"""
        strategy = self.config.get("search_strategy", "广度扫描")

        if strategy == "广度扫描":
            top_k = 10
            time_range = search_service.TIME_NO_LIMIT
        elif strategy == "深度挖掘":
            top_k = 5
            time_range = search_service.TIME_ONE_YEAR
        else:  # 边缘探索
            top_k = 7
            time_range = search_service.TIME_NO_LIMIT

        results = await search_service.search(
            query=query,
            top_k=top_k,
            time_range=time_range,
            contents={"rerankScore": True, "mainText": True}
        )

        return [r.to_dict() for r in results]

    async def _evaluate(
        self,
        topic: str,
        query: str,
        results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """评估搜索结果质量"""
        if not results:
            return {
                "overall_score": 0,
                "is_sufficient": False,
            }

        llm = create_llm(self.model)
        formatted = search_service.format_results_for_llm(
            [search_service.SearchResult(**r) for r in results]
        )

        prompt = EVALUATE_PROMPT.format(
            current_topic=topic,
            search_query=query,
            search_results=formatted,
            current_date=CURRENT_DATE
        )

        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        return parse_llm_json_response(response.content)


async def run_sub_agents_parallel(
    configs: List[SubTaskConfig],
    model: str,
    progress_callback: Optional[Callable] = None,
) -> List[AgentResult]:
    """
    并行运行多个子 Agent

    Args:
        configs: 子任务配置列表
        model: 模型名称
        progress_callback: 进度回调函数

    Returns:
        所有子 Agent 的执行结果
    """
    agents = [
        SubAgent(config, model, progress_callback)
        for config in configs
    ]

    # 并行执行
    results = await asyncio.gather(*[agent.execute() for agent in agents])

    return list(results)


async def run_sub_agents_sequential(
    configs: List[SubTaskConfig],
    model: str,
    progress_callback: Optional[Callable] = None,
) -> List[AgentResult]:
    """
    顺序运行多个子 Agent

    Args:
        configs: 子任务配置列表
        model: 模型名称
        progress_callback: 进度回调函数

    Returns:
        所有子 Agent 的执行结果
    """
    results = []

    for config in configs:
        agent = SubAgent(config, model, progress_callback)
        result = await agent.execute()
        results.append(result)

    return results