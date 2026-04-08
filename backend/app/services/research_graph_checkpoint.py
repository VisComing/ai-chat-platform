"""
Research Graph with Checkpointing
带检查点持久化的研究工作流
"""
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, TypedDict

from app.core.config import settings
from app.core.database import async_session_maker
from app.services.deep_research_service import deep_research_service
from app.services.search_service import search_service
from app.services.deep_research_prompts import (
    CLARIFY_PROMPT,
    PLAN_PROMPT,
    EVALUATE_PROMPT,
    SYNTHESIZE_PROMPT,
    CURRENT_DATE,
)
from app.services.deep_research_graph import create_llm, parse_llm_json_response

logger = logging.getLogger(__name__)


class ResearchState(TypedDict, total=False):
    """研究工作流状态"""
    # 基础信息
    task_id: str
    user_id: str
    query: str
    model: str

    # 澄清阶段
    needs_clarification: bool
    clarification_questions: List[str]
    clarified_requirements: str

    # 规划阶段
    research_goal: str
    sub_tasks: List[Dict[str, Any]]
    expected_sections: List[str]

    # 执行阶段
    current_task_index: int
    current_iteration: int
    collected_info: List[Dict[str, Any]]
    citations: List[Dict[str, Any]]

    # 结果
    report: str
    report_url: str

    # 元数据
    phase: str
    total_searches: int
    total_iterations: int


class ResearchGraphCheckpoint:
    """
    研究工作流检查点管理器

    使用数据库存储检查点状态，支持断点续跑
    """

    CHECKPOINT_TABLE = "research_checkpoints"

    async def save(self, task_id: str, state: ResearchState) -> None:
        """保存检查点"""
        async with async_session_maker() as session:
            from sqlalchemy import text
            # 使用 datetime 字面值代替 NOW() 以兼容 SQLite
            now = datetime.utcnow().isoformat()
            # 使用 UPSERT 模式
            await session.execute(
                text(f"""
                    INSERT INTO {self.CHECKPOINT_TABLE} (task_id, state, created_at, updated_at)
                    VALUES (:task_id, :state, :now, :now)
                    ON CONFLICT (task_id) DO UPDATE SET
                        state = EXCLUDED.state,
                        updated_at = EXCLUDED.updated_at
                """),
                {"task_id": task_id, "state": json.dumps(state, default=str), "now": now}
            )
            await session.commit()
            logger.debug(f"[Checkpoint] Saved state for task {task_id}")

    async def load(self, task_id: str) -> Optional[ResearchState]:
        """加载检查点"""
        async with async_session_maker() as session:
            from sqlalchemy import text
            result = await session.execute(
                text(f"SELECT state FROM {self.CHECKPOINT_TABLE} WHERE task_id = :task_id"),
                {"task_id": task_id}
            )
            row = result.fetchone()
            if row:
                logger.debug(f"[Checkpoint] Loaded state for task {task_id}")
                return json.loads(row[0])
            return None

    async def delete(self, task_id: str) -> None:
        """删除检查点"""
        async with async_session_maker() as session:
            from sqlalchemy import text
            await session.execute(
                text(f"DELETE FROM {self.CHECKPOINT_TABLE} WHERE task_id = :task_id"),
                {"task_id": task_id}
            )
            await session.commit()
            logger.debug(f"[Checkpoint] Deleted state for task {task_id}")


# 全局检查点管理器
checkpoint_manager = ResearchGraphCheckpoint()


async def init_checkpoint_table():
    """初始化检查点表（如果不存在）"""
    async with async_session_maker() as session:
        from sqlalchemy import text
        # 使用 TEXT 类型以兼容 SQLite 和 PostgreSQL
        await session.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {ResearchGraphCheckpoint.CHECKPOINT_TABLE} (
                task_id VARCHAR(36) PRIMARY KEY,
                state TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        await session.commit()


class ResearchGraphWithCheckpoint:
    """
    带检查点的研究工作流

    实现四阶段研究循环，每个阶段完成后保存检查点
    """

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.checkpoint = checkpoint_manager

    async def run(
        self,
        query: str,
        user_id: str,
        model: Optional[str] = None,
        skip_clarification: bool = False,
        clarified_requirements: Optional[str] = None,
        progress_callback=None,
    ) -> ResearchState:
        """
        执行完整的研究工作流

        Args:
            query: 研究问题
            user_id: 用户 ID
            model: 模型名称
            skip_clarification: 是否跳过澄清
            clarified_requirements: 已澄清的需求
            progress_callback: 进度回调函数

        Returns:
            最终状态
        """
        model = model or settings.deep_research_default_model

        # 尝试加载现有检查点
        state = await self.checkpoint.load(self.task_id)

        if state:
            logger.info(f"[ResearchGraph] Resuming from checkpoint, phase={state.get('phase')}")
        else:
            # 创建初始状态
            state = ResearchState(
                task_id=self.task_id,
                user_id=user_id,
                query=query,
                model=model,
                phase="clarify",
                current_task_index=0,
                current_iteration=0,
                collected_info=[],
                citations=[],
                total_searches=0,
                total_iterations=0,
            )

        try:
            # 阶段一：澄清
            if state.get("phase") == "clarify":
                state = await self._run_clarify(state, skip_clarification, progress_callback)
                if state.get("needs_clarification") and not skip_clarification:
                    # 需要用户澄清，暂停任务
                    await self.checkpoint.save(self.task_id, state)
                    return state
                await self.checkpoint.save(self.task_id, state)

            # 阶段二：规划
            if state.get("phase") == "plan":
                state = await self._run_plan(state, clarified_requirements, progress_callback)
                await self.checkpoint.save(self.task_id, state)

            # 阶段三：研究
            if state.get("phase") == "research":
                state = await self._run_research(state, progress_callback)
                await self.checkpoint.save(self.task_id, state)

            # 阶段四：综合
            if state.get("phase") == "synthesize":
                state = await self._run_synthesize(state, progress_callback)
                await self.checkpoint.save(self.task_id, state)

            # 完成
            state["phase"] = "completed"
            await self.checkpoint.delete(self.task_id)

            return state

        except Exception as e:
            logger.error(f"[ResearchGraph] Error in workflow: {e}")
            state["error"] = str(e)
            await self.checkpoint.save(self.task_id, state)
            raise

    async def _run_clarify(
        self,
        state: ResearchState,
        skip_clarification: bool,
        progress_callback,
    ) -> ResearchState:
        """执行澄清阶段"""
        if progress_callback:
            await progress_callback("clarify", "started", "正在分析研究需求...")

        if skip_clarification:
            state["needs_clarification"] = False
            state["phase"] = "plan"
            if progress_callback:
                await progress_callback("clarify", "completed", "跳过澄清，开始规划")
            return state

        llm = create_llm(state["model"])
        prompt = CLARIFY_PROMPT.format(query=state["query"])
        response = await llm.ainvoke([{"role": "system", "content": prompt}])
        result = parse_llm_json_response(response.content)

        state["needs_clarification"] = result.get("needs_clarification", False)

        if state["needs_clarification"]:
            state["clarification_questions"] = result.get("questions", [])
            state["phase"] = "clarify"  # 保持澄清阶段
            if progress_callback:
                await progress_callback("clarify", "waiting", "等待用户澄清")
        else:
            state["phase"] = "plan"
            if progress_callback:
                await progress_callback("clarify", "completed", "需求已明确，开始规划")

        return state

    async def _run_plan(
        self,
        state: ResearchState,
        clarified_requirements: Optional[str],
        progress_callback,
    ) -> ResearchState:
        """执行规划阶段"""
        if progress_callback:
            await progress_callback("plan", "started", "正在制定研究计划...")

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

        state["research_goal"] = result.get("research_goal", state["query"])
        state["sub_tasks"] = result.get("sub_tasks", [])
        state["expected_sections"] = result.get("expected_sections", [])
        state["phase"] = "research"
        state["current_task_index"] = 0

        if progress_callback:
            await progress_callback("plan", "completed", f"已规划 {len(state['sub_tasks'])} 个研究子任务")

        return state

    async def _run_research(
        self,
        state: ResearchState,
        progress_callback,
    ) -> ResearchState:
        """执行研究阶段"""
        sub_tasks = state.get("sub_tasks", [])
        if not sub_tasks:
            state["phase"] = "synthesize"
            return state

        for idx, task in enumerate(sub_tasks):
            state["current_task_index"] = idx
            task_topic = task.get("topic", f"子任务{idx + 1}")
            task_keywords = task.get("keywords", [])

            if progress_callback:
                await progress_callback(
                    "research", "started",
                    f"正在研究：{task_topic}",
                    {"currentTask": idx + 1, "totalTasks": len(sub_tasks)}
                )

            # 迭代搜索
            iteration = 0
            max_iterations = settings.deep_research_max_iterations

            while iteration < max_iterations:
                state["current_iteration"] = iteration

                # 构建搜索查询
                search_query = self._build_search_query(task, iteration)

                if progress_callback:
                    await progress_callback(
                        "research", "progress",
                        f"搜索：{search_query}",
                        {"iteration": iteration + 1, "maxIterations": max_iterations}
                    )

                # 执行搜索
                search_results = await self._execute_search(search_query, task)
                state["total_searches"] += 1

                # 收集信息
                for result in search_results:
                    state["collected_info"].append({
                        "task_idx": idx,
                        "topic": task_topic,
                        "query": search_query,
                        "source": result,
                    })
                    if result.get("link"):
                        state["citations"].append({
                            "title": result.get("title", ""),
                            "link": result.get("link", ""),
                            "published_time": result.get("published_time", ""),
                            "snippet": result.get("snippet", ""),
                        })

                # 评估
                if progress_callback:
                    await progress_callback("evaluate", "started", "正在评估信息质量...")

                evaluation = await self._evaluate(task_topic, search_query, search_results, state["model"])
                score = evaluation.get("overall_score", 0)
                is_sufficient = evaluation.get("is_sufficient", False) or score >= settings.deep_research_target_score

                state["total_iterations"] += 1

                if progress_callback:
                    await progress_callback("evaluate", "completed", f"评估得分：{score:.2f}")

                # 保存检查点
                await self.checkpoint.save(self.task_id, state)

                if is_sufficient:
                    break

                iteration += 1

            if progress_callback:
                await progress_callback(
                    "research", "completed",
                    f"子任务 '{task_topic}' 完成",
                    {"currentTask": idx + 1, "totalTasks": len(sub_tasks)}
                )

        state["phase"] = "synthesize"
        return state

    async def _run_synthesize(
        self,
        state: ResearchState,
        progress_callback,
    ) -> ResearchState:
        """执行综合阶段"""
        if progress_callback:
            await progress_callback("synthesize", "started", "正在生成研究报告...")

        llm = create_llm(state["model"])

        # 准备信息
        info_sections = []
        for task in state.get("sub_tasks", []):
            task_topic = task.get("topic", "")
            task_info = [i for i in state["collected_info"] if i.get("topic") == task_topic]
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

        if progress_callback:
            await progress_callback("synthesize", "completed", "研究报告已生成")

        return state

    def _build_search_query(self, task: Dict[str, Any], iteration: int) -> str:
        """构建搜索查询"""
        keywords = task.get("keywords", [])
        topic = task.get("topic", "")

        if iteration == 0:
            return keywords[0] if keywords else topic
        else:
            if len(keywords) > iteration:
                return keywords[iteration]
            elif len(keywords) > 1:
                return " ".join(keywords[:2])
            else:
                return f"{topic} 详细分析"

    async def _execute_search(self, query: str, task: Dict[str, Any]) -> List[Dict[str, Any]]:
        """执行搜索"""
        strategy = task.get("search_strategy", "广度扫描")

        if strategy == "广度扫描":
            top_k = 10
            time_range = search_service.TIME_NO_LIMIT
        elif strategy == "深度挖掘":
            top_k = 5
            time_range = search_service.TIME_ONE_YEAR
        else:
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
        results: List[Dict[str, Any]],
        model: str
    ) -> Dict[str, Any]:
        """评估搜索结果"""
        if not results:
            return {
                "overall_score": 0,
                "is_sufficient": False,
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