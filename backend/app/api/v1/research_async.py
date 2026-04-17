"""
Deep Research Async API Endpoints
深度研究异步任务 API
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Optional, List

from app.core.security import get_current_user_id
from app.core.config import settings
from app.models.research import (
    ResearchTask,
    ResearchClarification,
    ResearchTaskStatus,
    ResearchPhase,
)
from app.schemas.schemas import (
    ApiResponse,
    ResearchTaskCreate,
    ResearchTaskCreated,
    ResearchTaskStatus as ResearchTaskStatusSchema,
    ResearchTaskResult,
    ResearchTaskListItem,
    ClarificationRequest,
    SubTaskProgress,
    ResearchProgress,
    Citation,
)

router = APIRouter()
logger = logging.getLogger(__name__)


async def run_research_background(
    task_id: str,
    query: str,
    user_id: str,
    model: Optional[str] = None
):
    """后台执行研究任务（异步函数，直接在主事件循环中运行）"""
    from app.tasks.research_tasks import run_research_workflow, update_task_status
    from app.models.research import ResearchTaskStatus

    logger.info(f"[Background Task] Starting research task {task_id}")

    try:
        # 更新状态为运行中
        await update_task_status(task_id, ResearchTaskStatus.RUNNING, started_at=datetime.utcnow())

        # 执行研究工作流
        result = await run_research_workflow(
            task_id=task_id,
            query=query,
            user_id=user_id,
            model=model,
            skip_clarification=False,
        )

        logger.info(f"[Background Task] Research task {task_id} completed: {result.get('status')}")

    except Exception as e:
        logger.error(f"[Background Task] Task {task_id} failed: {e}", exc_info=True)
        await update_task_status(
            task_id,
            ResearchTaskStatus.FAILED,
            error_message=str(e),
            error_phase="unknown"
        )


async def resume_research_background(
    task_id: str,
    query: str,
    user_id: str,
    model: str,
    clarified_requirements: str
):
    """后台恢复研究任务（异步函数）"""
    from app.tasks.research_tasks import run_research_workflow, update_task_status
    from app.models.research import ResearchTaskStatus

    logger.info(f"[Background Task] Resuming research task {task_id}")

    try:
        await update_task_status(task_id, ResearchTaskStatus.RUNNING)

        result = await run_research_workflow(
            task_id=task_id,
            query=query,
            user_id=user_id,
            model=model,
            skip_clarification=True,
            clarified_requirements=clarified_requirements,
        )

        logger.info(f"[Background Task] Research task {task_id} resumed and completed")

    except Exception as e:
        logger.error(f"[Background Task] Task {task_id} resume failed: {e}", exc_info=True)
        await update_task_status(
            task_id,
            ResearchTaskStatus.FAILED,
            error_message=str(e),
            error_phase="clarify"
        )


@router.post("/tasks", response_model=ApiResponse[ResearchTaskCreated])
async def create_research_task(
    request: ResearchTaskCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    """
    创建深度研究任务

    任务将在后台异步执行，用户可以关闭页面后通过任务 ID 查询进度。
    """
    logger.info(f"[Research API] User {user_id} creating research task: {request.query[:50]}...")

    # 2. 创建任务记录
    task = ResearchTask(
        user_id=user_id,
        session_id=request.sessionId,
        query=request.query,
        model=request.model or settings.deep_research_default_model,
        status=ResearchTaskStatus.PENDING.value,
        phase=ResearchPhase.CLARIFY.value,
    )
    await task.insert()

    # 4. 启动后台异步任务 (使用 FastAPI BackgroundTasks)
    background_tasks.add_task(
        run_research_background,
        task.id,
        request.query,
        user_id,
        request.model,
    )

    logger.info(f"[Research API] Task {task.id} created and started in background")

    # 5. 返回响应
    return ApiResponse(
        success=True,
        data=ResearchTaskCreated(
            taskId=task.id,
            status=task.status,
            estimatedDuration="15-30 分钟",
            estimatedCost={
                "searches": "10-20次",
                "tokens": "约50000",
            },
            message="任务已创建，正在后台执行。请保存任务 ID 以便查询进度。",
        )
    )


@router.get("/tasks/{task_id}", response_model=ApiResponse[ResearchTaskStatusSchema])
async def get_task_status(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    查询任务状态和进度

    前端应每 3 秒轮询此接口获取最新进度。
    """
    logger.debug(f"[Research API] User {user_id} querying task {task_id}")

    # 查询任务
    task = await ResearchTask.find_one(
        ResearchTask.id == task_id,
        ResearchTask.user_id == user_id,
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail={"code": "TASK_NOT_FOUND", "message": "任务不存在或无权访问"}
        )

    # 计算耗时
    elapsed_time = None
    estimated_remaining = None
    if task.started_at:
        elapsed_time = int((datetime.utcnow() - task.started_at).total_seconds())
        # 简单估算剩余时间（假设平均30分钟）
        if task.status == ResearchTaskStatus.RUNNING.value:
            estimated_remaining = max(0, settings.deep_research_max_time_seconds - elapsed_time)

    # 构建进度信息
    progress = None
    if task.progress:
        progress = ResearchProgress(**task.progress)

    # 构建子任务进度
    sub_tasks_progress = None
    if task.sub_tasks and "tasks" in task.sub_tasks:
        tasks_list = task.sub_tasks["tasks"]
        current_idx = task.sub_tasks.get("current", 0)
        sub_tasks_progress = []
        for idx, t in enumerate(tasks_list):
            status = "completed" if idx < current_idx else ("in_progress" if idx == current_idx else "pending")
            sub_tasks_progress.append(SubTaskProgress(
                topic=t.get("topic", ""),
                status=status,
            ))

    # 构建引用列表
    citations_list = None
    if task.citations:
        citations_list = [Citation(**c) for c in task.citations]

    # 获取澄清问题（如果任务处于 paused 状态）
    clarification_questions = None
    if task.status == ResearchTaskStatus.PAUSED.value:
        clarification = await ResearchClarification.find_one(
            ResearchClarification.task_id == task_id
        )
        if clarification and clarification.questions:
            clarification_questions = clarification.questions

    return ApiResponse(
        success=True,
        data=ResearchTaskStatusSchema(
            taskId=task.id,
            query=task.query,
            status=task.status,
            phase=task.phase,
            phaseStatus=task.phase_status,
            phaseMessage=task.phase_message,
            progress=progress,
            subTasks=sub_tasks_progress,
            elapsedTime=elapsed_time,
            estimatedRemaining=estimated_remaining,
            citations=citations_list,
            clarificationQuestions=clarification_questions,
        )
    )


@router.post("/tasks/{task_id}/clarify", response_model=ApiResponse[dict])
async def submit_clarification(
    task_id: str,
    request: ClarificationRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    """
    提交澄清回复

    当任务状态为 paused 且需要澄清时，用户通过此接口提交回复。
    """
    logger.info(f"[Research API] User {user_id} submitting clarification for task {task_id}")

    # 查询任务
    task = await ResearchTask.find_one(
        ResearchTask.id == task_id,
        ResearchTask.user_id == user_id,
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail={"code": "TASK_NOT_FOUND", "message": "任务不存在或无权访问"}
        )

    if task.status != ResearchTaskStatus.PAUSED.value:
        raise HTTPException(
            status_code=400,
            detail={"code": "TASK_NOT_PAUSED", "message": "任务当前不在等待澄清状态"}
        )

    # 查询澄清问题记录
    clarification = await ResearchClarification.find_one(
        ResearchClarification.task_id == task_id
    )

    if not clarification:
        raise HTTPException(
            status_code=400,
            detail={"code": "NO_CLARIFICATION", "message": "任务没有待回复的澄清问题"}
        )

    # 保存用户回复
    clarification.answers = request.answers
    clarification.answered_at = datetime.utcnow()
    await clarification.save()

    # 构建澄清后的需求
    clarified_requirements = "\n".join([f"用户澄清：{a}" for a in request.answers])
    task.clarified_requirements = clarified_requirements
    await task.save()

    # 启动后台任务继续执行
    background_tasks.add_task(
        resume_research_background,
        task_id,
        task.query,
        user_id,
        task.model,
        clarified_requirements,
    )

    logger.info(f"[Research API] Task {task_id} clarification submitted, resuming in background")

    return ApiResponse(
        success=True,
        data={
            "taskId": task_id,
            "status": ResearchTaskStatus.RUNNING.value,
            "message": "已收到澄清回复，任务继续执行",
        }
    )


@router.delete("/tasks/{task_id}", response_model=ApiResponse[dict])
async def cancel_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    取消任务

    仅当任务处于 pending 或 running 状态时可以取消。
    """
    logger.info(f"[Research API] User {user_id} cancelling task {task_id}")

    # 查询任务
    task = await ResearchTask.find_one(
        ResearchTask.id == task_id,
        ResearchTask.user_id == user_id,
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail={"code": "TASK_NOT_FOUND", "message": "任务不存在或无权访问"}
        )

    if task.status not in [ResearchTaskStatus.PENDING.value, ResearchTaskStatus.RUNNING.value, ResearchTaskStatus.PAUSED.value]:
        raise HTTPException(
            status_code=400,
            detail={"code": "TASK_NOT_CANCELLABLE", "message": f"任务当前状态为 {task.status}，无法取消"}
        )

    # 更新任务状态为已取消
    task.status = ResearchTaskStatus.CANCELLED.value
    task.completed_at = datetime.utcnow()
    await task.save()

    logger.info(f"[Research API] Task {task_id} cancelled")

    return ApiResponse(
        success=True,
        data={
            "taskId": task_id,
            "status": ResearchTaskStatus.CANCELLED.value,
            "message": "任务已取消",
        }
    )


@router.get("/tasks/{task_id}/result", response_model=ApiResponse[ResearchTaskResult])
async def get_task_result(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    获取任务结果

    仅当任务状态为 completed 时可以获取结果。
    """
    logger.info(f"[Research API] User {user_id} getting result for task {task_id}")

    # 查询任务
    task = await ResearchTask.find_one(
        ResearchTask.id == task_id,
        ResearchTask.user_id == user_id,
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail={"code": "TASK_NOT_FOUND", "message": "任务不存在或无权访问"}
        )

    if task.status != ResearchTaskStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail={"code": "TASK_NOT_COMPLETED", "message": f"任务当前状态为 {task.status}，尚未完成"}
        )

    # 构建引用列表
    citations_list = None
    if task.citations:
        citations_list = [Citation(**c) for c in task.citations]

    # 构建统计数据
    stats = None
    if task.progress:
        stats = task.progress

    # 生成报告下载 URL
    report_url = f"/api/v1/files/research/{task_id}/report.md" if task.result_url else None

    return ApiResponse(
        success=True,
        data=ResearchTaskResult(
            taskId=task.id,
            status=task.status,
            reportUrl=report_url,
            reportPreview=task.report_preview,
            citations=citations_list,
            stats=stats,
        )
    )


@router.get("/tasks", response_model=ApiResponse[List[ResearchTaskListItem]])
async def list_user_tasks(
    status: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    """
    获取用户的任务列表

    支持按状态筛选。
    """
    logger.debug(f"[Research API] User {user_id} listing tasks, status={status}")

    # 构建查询条件
    query = ResearchTask.find(ResearchTask.user_id == user_id)
    if status:
        query = ResearchTask.find(
            ResearchTask.user_id == user_id,
            ResearchTask.status == status,
        )

    # 查询任务列表
    tasks = await query.sort("-created_at").limit(limit).skip(offset).to_list()

    # 构建响应
    task_list = []
    for t in tasks:
        task_list.append(ResearchTaskListItem(
            taskId=t.id,
            query=t.query,
            status=t.status,
            phase=t.phase,
            createdAt=t.created_at,
            completedAt=t.completed_at,
            resultUrl=f"/api/v1/files/research/{t.id}/report.md" if t.result_url else None,
        ))

    return ApiResponse(success=True, data=task_list)