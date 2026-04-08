"""
Deep Research Service - 深度研究核心服务
封装完整的 SSE 流式输出能力
"""
import json
import logging
import time
from typing import AsyncGenerator, Dict, Any, List, Optional
from datetime import datetime

from app.core.config import get_settings
from app.services.deep_research_graph import create_llm, parse_llm_json_response
from app.services.search_service import search_service
from app.services.deep_research_prompts import (
    CURRENT_DATE,
    CLARIFY_PROMPT,
    PLAN_PROMPT,
    EVALUATE_PROMPT,
    SYNTHESIZE_PROMPT,
)

logger = logging.getLogger(__name__)


class DeepResearchService:
    """深度研究服务"""

    def __init__(self):
        self.settings = get_settings()

    async def research(
        self,
        query: str,
        model: Optional[str] = None,
        skip_clarification: bool = False,
        clarified_requirements: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        执行深度研究，返回 SSE 事件流

        Args:
            query: 用户原始问题
            model: 模型名称（可选）
            skip_clarification: 是否跳过澄清阶段
            clarified_requirements: 用户已澄清的需求

        Yields:
            SSE 事件字典
        """
        start_time = time.time()
        model = model or self.settings.deep_research_default_model

        # 发送开始事件
        yield {
            "event": "research_start",
            "data": {
                "type": "research_start",
                "query": query,
                "model": model,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }

        try:
            # ========== 范围澄清阶段 ==========
            if not skip_clarification and self.settings.deep_research_enable_clarification:
                yield self._phase_event("clarify", "started", "正在分析研究需求...")

                clarification_result = await self._clarify(query, model)

                if clarification_result.get("needs_clarification"):
                    questions = clarification_result.get("questions", [])

                    yield {
                        "event": "clarification_request",
                        "data": {
                            "type": "clarification_request",
                            "questions": questions,
                            "message": "为了提供更精准的研究报告，请回答以下问题：",
                        }
                    }
                    yield self._phase_event("clarify", "waiting", "等待用户回复澄清问题...")

                    # 注意：这里暂停，等待用户通过 /research/clarify 端点回复
                    # 实际流程中，用户回复后会重新调用 research() 并传入 clarified_requirements
                    return
                else:
                    yield self._phase_event("clarify", "completed", "需求已明确，开始规划研究方案")

            # ========== 规划阶段 ==========
            yield self._phase_event("plan", "started", "正在制定研究计划...")

            plan_result = await self._plan(query, clarified_requirements, model)

            sub_tasks = plan_result.get("sub_tasks", [])
            research_goal = plan_result.get("research_goal", query)

            yield {
                "event": "research_plan",
                "data": {
                    "type": "research_plan",
                    "goal": research_goal,
                    "subTasks": sub_tasks,
                    "totalTasks": len(sub_tasks),
                }
            }
            yield self._phase_event("plan", "completed", f"已规划 {len(sub_tasks)} 个研究子任务")

            # ========== 迭代研究阶段 ==========
            all_collected_info = []
            all_citations = []

            for task_idx, task in enumerate(sub_tasks):
                task_topic = task.get("topic", f"子任务{task_idx + 1}")
                task_keywords = task.get("keywords", [])
                search_strategy = task.get("search_strategy", "广度扫描")

                yield self._phase_event(
                    "search",
                    "started",
                    f"正在研究：{task_topic}",
                    {"currentTask": task_idx + 1, "totalTasks": len(sub_tasks)}
                )

                iteration_count = 0
                max_iterations = self.settings.deep_research_max_iterations

                while iteration_count < max_iterations:
                    # 执行搜索
                    search_query = self._build_search_query(task, iteration_count)
                    time_range = self._select_time_range(search_strategy, iteration_count)

                    yield {
                        "event": "search_progress",
                        "data": {
                            "type": "search_progress",
                            "iteration": iteration_count + 1,
                            "maxIterations": max_iterations,
                            "query": search_query,
                            "taskTopic": task_topic,
                        }
                    }

                    # 执行搜索
                    search_results = await self._execute_search(
                        search_query, time_range, search_strategy
                    )

                    logger.info(f"[Deep Research] Search for '{search_query}' returned {len(search_results)} results")

                    # 收集信息和引用
                    for result in search_results:
                        all_collected_info.append({
                            "task_idx": task_idx,
                            "topic": task_topic,
                            "query": search_query,
                            "source": result,
                        })
                        if result.get("link"):
                            all_citations.append({
                                "title": result.get("title", ""),
                                "link": result.get("link", ""),
                                "published_time": result.get("published_time", ""),
                                "snippet": result.get("snippet", ""),
                                "rerank_score": result.get("rerank_score"),
                            })

                    yield {
                        "event": "search_complete",
                        "data": {
                            "type": "search_complete",
                            "resultCount": len(search_results),
                            "collectedInfoCount": len(all_collected_info),
                            "citationCount": len(all_citations),
                        }
                    }

                    # 评估信息质量
                    yield self._phase_event("evaluate", "started", "正在评估信息质量...")

                    evaluation = await self._evaluate(
                        task_topic, search_query, search_results, model
                    )

                    overall_score = evaluation.get("overall_score", 0)
                    is_sufficient = evaluation.get("is_sufficient", False) or overall_score >= self.settings.deep_research_target_score

                    yield {
                        "event": "evaluation_result",
                        "data": {
                            "type": "evaluation_result",
                            "score": overall_score,
                            "isSufficient": is_sufficient,
                            "iteration": iteration_count + 1,
                        }
                    }
                    yield self._phase_event("evaluate", "completed", f"信息评估得分：{overall_score:.2f}")

                    # 判断是否继续迭代
                    if is_sufficient:
                        logger.info(f"[Deep Research] Task '{task_topic}' is sufficient, moving to next")
                        break

                    iteration_count += 1

                    # 发送反思事件
                    yield self._phase_event("reflect", "started", "正在分析信息缺口...")

                    # 简化：不等待LLM反思，直接判断是否继续
                    if iteration_count < max_iterations:
                        yield self._phase_event("reflect", "completed", f"继续补充搜索（迭代 {iteration_count + 1}）")
                    else:
                        yield self._phase_event("reflect", "completed", "达到最大迭代次数，准备综合")

                yield self._phase_event(
                    "search",
                    "completed",
                    f"子任务 '{task_topic}' 研究完成",
                    {"currentTask": task_idx + 1, "totalTasks": len(sub_tasks)}
                )

            # ========== 综合阶段 ==========
            yield self._phase_event("synthesize", "started", "正在整合研究结果，生成报告...")

            report = await self._synthesize(
                query, plan_result, all_collected_info, all_citations, model
            )

            # 去重引用
            unique_citations = []
            seen_links = set()
            for c in all_citations:
                if c.get("link") and c.get("link") not in seen_links:
                    seen_links.add(c.get("link"))
                    unique_citations.append(c)

            yield self._phase_event("synthesize", "completed", "研究报告已生成")

            # 发送最终报告
            yield {
                "event": "research_complete",
                "data": {
                    "type": "research_complete",
                    "report": report,
                    "citations": unique_citations[:15],
                    "duration": time.time() - start_time,
                    "stats": {
                        "totalTasks": len(sub_tasks),
                        "totalIterations": sum([self.settings.deep_research_max_iterations for _ in sub_tasks]),
                        "collectedInfoCount": len(all_collected_info),
                        "citationCount": len(unique_citations),
                    }
                }
            }

        except Exception as e:
            logger.error(f"[Deep Research] Error: {e}")
            yield {
                "event": "error",
                "data": {
                    "type": "error",
                    "content": str(e),
                    "phase": "unknown",
                }
            }

    async def clarify(
        self,
        query: str,
        clarified_answers: List[str],
        model: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        处理用户的澄清回复，然后继续研究

        Args:
            query: 用户原始问题
            clarified_answers: 用户对澄清问题的回答
            model: 模型名称

        Yields:
            SSE 事件字典
        """
        # 合并用户的澄清回复
        clarified_requirements = "\n".join([
            f"用户澄清：{answer}"
            for answer in clarified_answers
        ])

        # 继续研究流程（跳过澄清阶段）
        async for event in self.research(
            query=query,
            model=model,
            skip_clarification=True,
            clarified_requirements=clarified_requirements,
        ):
            yield event

    # ========== 内部方法 ==========

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

    async def _clarify(self, query: str, model: str) -> Dict[str, Any]:
        """执行澄清分析"""
        llm = create_llm(model)
        prompt = CLARIFY_PROMPT.format(query=query)
        response = await llm.ainvoke([{"role": "system", "content": prompt}])

        return parse_llm_json_response(response.content)

    async def _plan(self, query: str, clarified: Optional[str], model: str) -> Dict[str, Any]:
        """执行研究规划"""
        llm = create_llm(model)

        requirements_section = ""
        if clarified:
            requirements_section = f"澄清后的需求：{clarified}"

        prompt = PLAN_PROMPT.format(
            query=query,
            clarified_requirements=requirements_section
        )

        response = await llm.ainvoke([{"role": "system", "content": prompt}])

        return parse_llm_json_response(response.content)

    async def _execute_search(
        self,
        query: str,
        time_range: str,
        strategy: str
    ) -> List[Dict[str, Any]]:
        """执行搜索"""
        # 根据策略确定top_k
        if strategy == "广度扫描":
            top_k = 10
        elif strategy == "深度挖掘":
            top_k = 5
        else:
            top_k = 7

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
        results: List[Dict[str, Any]],
        model: str
    ) -> Dict[str, Any]:
        """评估搜索结果质量"""
        if not results:
            return {
                "overall_score": 0,
                "is_sufficient": False,
                "scores": {"completeness": 0, "authority": 0, "timeliness": 0, "diversity": 0},
                "weaknesses": ["未找到相关结果"],
            }

        llm = create_llm(model)

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

    async def _synthesize(
        self,
        query: str,
        plan: Dict[str, Any],
        collected_info: List[Dict[str, Any]],
        citations: List[Dict[str, Any]],
        model: str
    ) -> str:
        """综合生成报告"""
        llm = create_llm(model)

        info_sections = []
        for task in plan.get("sub_tasks", []):
            task_topic = task.get("topic", "")
            task_info = [i for i in collected_info if i.get("topic") == task_topic]
            if task_info:
                info_text = f"\n### {task_topic}\n"
                for info in task_info[:5]:
                    source = info.get("source", {})
                    info_text += f"- {source.get('title', '')}: {source.get('snippet', '')}\n"
                info_sections.append(info_text)

        all_info_text = "\n".join(info_sections) if info_sections else "无收集信息"

        prompt = SYNTHESIZE_PROMPT.format(
            research_goal=plan.get("research_goal", query),
            research_plan=json.dumps(plan, ensure_ascii=False, indent=2),
            all_collected_info=all_info_text,
        )

        response = await llm.ainvoke([{"role": "system", "content": prompt}])

        return response.content

    def _build_search_query(self, task: Dict[str, Any], iteration: int) -> str:
        """构建搜索查询"""
        keywords = task.get("keywords", [])
        topic = task.get("topic", "")

        if iteration == 0:
            # 第一轮：使用主要关键词
            return keywords[0] if keywords else topic
        else:
            # 后续轮次：组合关键词或使用不同关键词
            if len(keywords) > iteration:
                return keywords[iteration]
            elif len(keywords) > 1:
                return " ".join(keywords[:2])
            else:
                return f"{topic} 详细分析"

    def _select_time_range(self, strategy: str, iteration: int) -> str:
        """选择时间范围"""
        if strategy == "广度扫描":
            return search_service.TIME_NO_LIMIT
        elif strategy == "深度挖掘":
            return search_service.TIME_ONE_YEAR
        else:  # 边缘探索
            if iteration == 0:
                return search_service.TIME_ONE_MONTH
            return search_service.TIME_NO_LIMIT


# 单例实例
deep_research_service = DeepResearchService()