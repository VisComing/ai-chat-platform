"""
Deep Research Huey Tasks
深度研究异步任务执行
"""
import asyncio
import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from app.core.huey_app import huey
from app.core.config import settings
from app.core.database import async_session_maker
from app.models.research import ResearchTask, ResearchTaskStatus, ResearchPhase, ResearchClarification
from app.services.deer_flow_service import deer_flow_service

logger = logging.getLogger(__name__)


def run_async(coro):
    """在同步上下文中运行异步函数，确保在新线程中使用新的事件循环"""
    result = None
    exception = None

    def run_in_thread():
        nonlocal result, exception
        # 在新线程中创建新的事件循环
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(coro)
        except Exception as e:
            exception = e
        finally:
            loop.close()

    thread = threading.Thread(target=run_in_thread)
    thread.start()
    thread.join(timeout=300)  # 5分钟超时

    if exception:
        raise exception
    return result


@huey.task(retries=3, retry_delay=60)
def execute_research(task_id: str, query: str, user_id: str, model: Optional[str] = None):
    """
    执行深度研究任务

    Args:
        task_id: 任务 ID
        query: 用户研究问题
        user_id: 用户 ID
        model: 模型名称（可选）
    """
    logger.info(f"[Huey Task] Starting research task {task_id} for user {user_id}")

    try:
        # 更新任务状态为 running
        run_async(update_task_status(task_id, ResearchTaskStatus.RUNNING, started_at=datetime.utcnow()))

        # 执行研究工作流
        result = run_async(run_research_workflow(task_id, query, user_id, model))

        logger.info(f"[Huey Task] Research task {task_id} completed successfully")
        return result

    except Exception as e:
        logger.error(f"[Huey Task] Task {task_id} failed: {e}")
        run_async(update_task_status(
            task_id,
            ResearchTaskStatus.FAILED,
            error_message=str(e),
            error_phase="unknown"
        ))
        raise


@huey.task(retries=2, retry_delay=60)
def resume_research(task_id: str):
    """
    从暂停状态恢复研究任务（用户提交澄清回复后）

    Args:
        task_id: 任务 ID
    """
    logger.info(f"[Huey Task] Resuming research task {task_id}")

    try:
        # 获取任务信息
        task_info = run_async(get_task_info(task_id))

        if not task_info:
            raise ValueError(f"Task {task_id} not found")

        if task_info["status"] != ResearchTaskStatus.PAUSED.value:
            raise ValueError(f"Task {task_id} is not in paused state")

        # 更新状态为 running
        run_async(update_task_status(task_id, ResearchTaskStatus.RUNNING))

        # 继续执行研究（跳过澄清阶段）
        result = run_async(run_research_workflow(
            task_id,
            task_info["query"],
            task_info["user_id"],
            task_info.get("model"),
            skip_clarification=True,
            clarified_requirements=task_info.get("clarified_requirements")
        ))

        logger.info(f"[Huey Task] Research task {task_id} resumed and completed")
        return result

    except Exception as e:
        logger.error(f"[Huey Task] Failed to resume task {task_id}: {e}")
        run_async(update_task_status(
            task_id,
            ResearchTaskStatus.FAILED,
            error_message=str(e),
            error_phase="clarify"
        ))
        raise


async def update_task_status(
    task_id: str,
    status: ResearchTaskStatus,
    phase: Optional[str] = None,
    phase_status: Optional[str] = None,
    phase_message: Optional[str] = None,
    progress: Optional[Dict] = None,
    sub_tasks: Optional[Dict] = None,
    started_at: Optional[datetime] = None,
    completed_at: Optional[datetime] = None,
    error_message: Optional[str] = None,
    error_phase: Optional[str] = None,
    result_url: Optional[str] = None,
    report_preview: Optional[str] = None,
    citations: Optional[List] = None,
):
    """更新任务状态到数据库"""
    async with async_session_maker() as session:
        try:
            # 查询任务
            from sqlalchemy import select
            result = await session.execute(
                select(ResearchTask).where(ResearchTask.id == task_id)
            )
            task = result.scalar_one_or_none()

            if not task:
                logger.error(f"Task {task_id} not found in database")
                return

            # 更新字段
            task.status = status.value
            task.updated_at = datetime.utcnow()

            if phase:
                task.phase = phase
            if phase_status:
                task.phase_status = phase_status
            if phase_message:
                task.phase_message = phase_message
            if progress:
                task.progress = progress
            if sub_tasks:
                task.sub_tasks = sub_tasks
            if started_at:
                task.started_at = started_at
            if completed_at:
                task.completed_at = completed_at
            if error_message:
                task.error_message = error_message
            if error_phase:
                task.error_phase = error_phase
            if result_url:
                task.result_url = result_url
            if report_preview:
                task.report_preview = report_preview
            if citations:
                task.citations = citations

            await session.commit()
            logger.debug(f"Task {task_id} status updated to {status.value}")

        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")
            await session.rollback()


async def update_task_progress(
    task_id: str,
    phase: str,
    phase_status: str,
    phase_message: str,
    progress: Optional[Dict] = None,
    sub_tasks: Optional[Dict] = None,
):
    """更新任务进度（在工作流执行过程中调用）"""
    await update_task_status(
        task_id=task_id,
        status=ResearchTaskStatus.RUNNING,
        phase=phase,
        phase_status=phase_status,
        phase_message=phase_message,
        progress=progress,
        sub_tasks=sub_tasks,
    )


async def get_task_info(task_id: str) -> Optional[Dict]:
    """获取任务信息"""
    async with async_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(ResearchTask).where(ResearchTask.id == task_id)
        )
        task = result.scalar_one_or_none()

        if task:
            return {
                "id": task.id,
                "user_id": task.user_id,
                "query": task.query,
                "status": task.status,
                "phase": task.phase,
                "model": task.model,
                "clarified_requirements": task.clarified_requirements,
                "progress": task.progress,
            }
        return None


async def run_research_workflow(
    task_id: str,
    query: str,
    user_id: str,
    model: Optional[str] = None,
    skip_clarification: bool = False,
    clarified_requirements: Optional[str] = None,
) -> Dict[str, Any]:
    """
    运行深度研究工作流

    Args:
        task_id: 任务 ID
        query: 研究问题
        user_id: 用户 ID
        model: 模型名称
        skip_clarification: 是否跳过澄清阶段
        clarified_requirements: 已澄清的需求

    Returns:
        研究结果
    """
    model = model or settings.deep_research_default_model

    # 收集结果
    collected_info = []
    citations = []
    report = ""
    sub_tasks = []

    try:
        # 执行研究流（使用 DeerFlow 服务）
        async for event in deer_flow_service.research(
            query=query,
            model=model,
            skip_clarification=skip_clarification,
            clarified_requirements=clarified_requirements,
        ):
            event_type = event.get("event", "")
            event_data = event.get("data", {})

            # 处理不同类型的事件
            if event_type == "research_phase":
                phase = event_data.get("phase", "")
                phase_status = event_data.get("status", "")
                phase_message = event_data.get("message", "")
                progress_data = event_data.get("progress", {})

                await update_task_progress(
                    task_id, phase, phase_status, phase_message, progress_data
                )

                # 检查是否需要暂停等待用户澄清
                if phase == "clarify" and phase_status == "waiting":
                    await update_task_status(
                        task_id,
                        ResearchTaskStatus.PAUSED,
                        phase="clarify",
                        phase_status="waiting",
                        phase_message="等待用户澄清",
                    )
                    return {"status": "paused", "needs_clarification": True}

            elif event_type == "clarification_request":
                # 保存澄清问题到数据库
                questions = event_data.get("questions", [])
                if questions:
                    await save_clarification_questions(task_id, questions)
                    await update_task_status(
                        task_id,
                        ResearchTaskStatus.PAUSED,
                        phase="clarify",
                        phase_status="waiting",
                        phase_message="等待用户澄清",
                    )
                    return {"status": "paused", "needs_clarification": True}

            elif event_type == "research_plan":
                sub_tasks = event_data.get("subTasks", [])
                await update_task_status(
                    task_id,
                    ResearchTaskStatus.RUNNING,
                    sub_tasks={"tasks": sub_tasks, "current": 0},
                )

            elif event_type == "search_progress":
                iteration = event_data.get("iteration", 0)
                task_topic = event_data.get("taskTopic", "")
                # 更新迭代次数
                progress_update = {"iteration": iteration}
                await update_task_progress(
                    task_id, "research", "started", f"搜索: {task_topic}", progress_update
                )

            elif event_type == "search_complete":
                collected_count = event_data.get("collectedInfoCount", 0)
                citation_count = event_data.get("citationCount", 0)
                progress_update = {
                    "collectedInfoCount": collected_count,
                    "citationCount": citation_count,
                }
                await update_task_progress(
                    task_id, "research", "completed", f"已收集 {collected_count} 条信息", progress_update
                )

            elif event_type == "evaluation_result":
                score = event_data.get("score", 0)
                is_sufficient = event_data.get("isSufficient", False)
                progress_update = {"score": score, "isSufficient": is_sufficient}
                await update_task_progress(
                    task_id, "evaluate", "completed", f"评估得分: {score:.2f}", progress_update
                )

            elif event_type == "research_complete":
                report = event_data.get("report", "")
                citations = event_data.get("citations", [])
                duration = event_data.get("duration", 0)
                stats = event_data.get("stats", {})

                # 保存报告到本地文件
                result_url = await save_report_local(report, task_id)

                # 提取报告摘要（前500字符）
                report_preview = report[:500] if report else ""

                # 更新任务完成状态
                await update_task_status(
                    task_id,
                    ResearchTaskStatus.COMPLETED,
                    phase="synthesize",
                    phase_status="completed",
                    phase_message="研究报告已生成",
                    completed_at=datetime.utcnow(),
                    result_url=result_url,
                    report_preview=report_preview,
                    citations=citations,
                    progress={"duration": duration, **stats},
                )

                return {
                    "status": "completed",
                    "report_url": result_url,
                    "citations": citations,
                    "duration": duration,
                }

            elif event_type == "error":
                error_content = event_data.get("content", "")
                error_phase = event_data.get("phase", "")
                await update_task_status(
                    task_id,
                    ResearchTaskStatus.FAILED,
                    error_message=error_content,
                    error_phase=error_phase,
                )
                raise Exception(error_content)

        # 如果工作流正常结束但没有收到 complete 事件
        await update_task_status(
            task_id,
            ResearchTaskStatus.COMPLETED,
            completed_at=datetime.utcnow(),
        )

        return {"status": "completed"}

    except Exception as e:
        logger.error(f"Research workflow failed for task {task_id}: {e}")
        await update_task_status(
            task_id,
            ResearchTaskStatus.FAILED,
            error_message=str(e),
            error_phase="unknown",
        )
        raise


async def save_clarification_questions(task_id: str, questions: List[str]):
    """保存澄清问题到数据库"""
    async with async_session_maker() as session:
        clarification = ResearchClarification(
            task_id=task_id,
            questions=questions,
        )
        session.add(clarification)
        await session.commit()


async def save_report_local(report_content: str, task_id: str) -> str:
    """保存报告到本地文件系统"""
    # 创建目录
    reports_dir = Path(settings.upload_dir) / "research" / task_id
    reports_dir.mkdir(parents=True, exist_ok=True)

    # 保存 Markdown 报告
    report_path = reports_dir / "report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    # 返回相对路径
    return f"research/{task_id}/report.md"


async def increment_task_stats(task_id: str, field: str, value: int = 1):
    """增加任务统计字段"""
    async with async_session_maker() as session:
        from sqlalchemy import select, update
        result = await session.execute(
            select(ResearchTask).where(ResearchTask.id == task_id)
        )
        task = result.scalar_one_or_none()

        if task:
            if field == "total_iterations":
                task.total_iterations += value
            elif field == "total_searches":
                task.total_searches += value
            elif field == "token_usage":
                task.token_usage += value
            await session.commit()