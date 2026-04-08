"""
Chat API Endpoints

支持可恢复的流式聊天，刷新页面后可以继续接收回复。
"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas import ChatRequest, ApiResponse
from app.models import Session, Message, ChatTask
from app.services.ai_service import ai_service
from app.services.chat_task_service import chat_task_manager
from app.services.title_service import generate_and_push_title

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    统一聊天流端点

    创建后台任务并返回 SSE 流。
    支持刷新页面后通过 /tasks/{taskId}/subscribe 恢复订阅。

    SSE Events:
    - task: 任务创建事件，包含 taskId
    - session: 新会话创建事件
    - thinking: AI 思考中（深度思考模式）
    - tool_call: Agent 调用工具
    - text: 文本块
    - title: 自动生成的会话标题
    - complete: 响应完成
    - error: 错误
    """
    # 确保 content 是 dict
    content = request.content
    if hasattr(content, 'model_dump'):
        content = content.model_dump()

    async def event_generator():
        try:
            async for event in _create_and_stream_chat(
                db=db,
                user_id=user_id,
                session_id=request.sessionId,
                content=content,
                model=request.model,
                use_agent=request.useAgent,
                enable_thinking=request.enableThinking,
            ):
                yield event
        except Exception as e:
            logger.error(f"[Chat API] Error: {e}")
            yield {
                "event": "error",
                "data": json.dumps({"type": "error", "content": str(e)}, ensure_ascii=False),
            }

    return EventSourceResponse(event_generator())


@router.get("/tasks/{task_id}/subscribe")
async def subscribe_to_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    订阅正在运行的任务

    用于刷新页面后恢复 SSE 流。
    """
    # 验证任务所有权
    result = await db.execute(
        select(ChatTask).where(
            ChatTask.id == task_id,
            ChatTask.user_id == user_id,
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        async def error_generator():
            yield {
                "event": "error",
                "data": json.dumps({"type": "error", "content": "任务不存在"}, ensure_ascii=False),
            }
        return EventSourceResponse(error_generator())

    if task.status == "completed":
        async def completed_generator():
            yield {
                "event": "complete",
                "data": json.dumps({
                    "type": "complete",
                    "messageId": task.message_id,
                    "resumed": True,
                }, ensure_ascii=False),
            }
        return EventSourceResponse(completed_generator())

    if task.status not in ["pending", "running"]:
        async def error_generator():
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "content": f"任务状态: {task.status}",
                }, ensure_ascii=False),
            }
        return EventSourceResponse(error_generator())

    # 订阅任务事件
    async def event_generator():
        queue = await chat_task_manager.subscribe(task_id)
        try:
            # 发送恢复事件
            yield {
                "event": "resumed",
                "data": json.dumps({
                    "type": "resumed",
                    "taskId": task_id,
                    "messageId": task.message_id,
                }, ensure_ascii=False),
            }

            # 持续接收事件
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield event

                    # 检查是否完成
                    if event.get("event") in ["complete", "error"]:
                        break
                except asyncio.TimeoutError:
                    # 发送心跳
                    yield {"event": "heartbeat", "data": "{}"}
        finally:
            await chat_task_manager.unsubscribe(task_id, queue)

    return EventSourceResponse(event_generator())


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    取消正在运行的任务
    """
    # 验证任务所有权
    result = await db.execute(
        select(ChatTask).where(
            ChatTask.id == task_id,
            ChatTask.user_id == user_id,
        )
    )
    task = result.scalar_one_or_none()

    if not task:
        return ApiResponse(
            success=False,
            message="任务不存在",
        )

    cancelled = await chat_task_manager.cancel_task(db, task_id)

    if cancelled:
        return ApiResponse(
            success=True,
            data={"taskId": task_id, "status": "cancelled"},
        )
    else:
        return ApiResponse(
            success=False,
            message="无法取消任务",
        )


@router.get("/sessions/{session_id}/running-task")
async def get_running_task(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取会话中正在运行的任务

    前端刷新后调用此接口检查是否有正在进行的生成任务。
    """
    task = await chat_task_manager.get_running_task_for_session(
        db=db,
        session_id=session_id,
        user_id=user_id,
    )

    if task:
        return ApiResponse(
            success=True,
            data={
                "taskId": task.id,
                "messageId": task.message_id,
                "status": task.status,
            },
        )
    else:
        return ApiResponse(
            success=True,
            data=None,
        )


@router.get("/models")
async def get_supported_models():
    """获取支持的 AI 模型列表"""
    return {
        "success": True,
        "data": ai_service.get_supported_models()
    }


# 导入 asyncio 用于 subscribe 端点
import asyncio


async def _create_and_stream_chat(
    db: AsyncSession,
    user_id: str,
    session_id: str | None,
    content: dict,
    model: str | None,
    use_agent: bool = False,
    enable_thinking: bool = False,
):
    """
    创建任务并流式返回事件

    内部实现：创建后台任务，同时订阅事件。
    """
    from app.core.config import settings
    model = model or settings.default_model

    # ========== 会话管理 ==========
    if not session_id:
        session = Session(
            user_id=user_id,
            title="新对话",
            default_model=model,
        )
        db.add(session)
        await db.flush()
        session_id = session.id

        yield {
            "event": "session",
            "data": json.dumps({"sessionId": session_id}, ensure_ascii=False),
        }
    else:
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == user_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            session = Session(
                user_id=user_id,
                title="新对话",
                default_model=model,
            )
            db.add(session)
            await db.flush()
            session_id = session.id

            yield {
                "event": "session",
                "data": json.dumps({"sessionId": session_id}, ensure_ascii=False),
            }

    # ========== 创建用户消息 ==========
    user_message = Message(
        session_id=session_id,
        role="user",
        content=content if isinstance(content, dict) else {"type": "text", "text": str(content)},
        status="completed",
    )
    db.add(user_message)
    await db.flush()

    session.message_count += 1
    session.last_message_at = datetime.utcnow()
    await db.commit()

    # ========== 创建 AI 消息占位符 ==========
    ai_message = Message(
        session_id=session_id,
        role="assistant",
        content={"type": "text", "text": ""},
        status="streaming",
    )
    db.add(ai_message)
    await db.flush()
    await db.commit()

    message_id = ai_message.id

    # ========== 创建任务 ==========
    task = await chat_task_manager.create_task(
        db=db,
        user_id=user_id,
        session_id=session_id,
        message_id=message_id,
    )

    # 发送任务创建事件
    yield {
        "event": "task",
        "data": json.dumps({"taskId": task.id, "messageId": message_id}, ensure_ascii=False),
    }

    # ========== 获取历史消息 ==========
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id, Message.id != message_id)
        .order_by(Message.created_at)
        .limit(20)
    )
    history_messages = result.scalars().all()

    messages = []
    for msg in history_messages:
        msg_content = msg.content if isinstance(msg.content, dict) else {"type": "text", "text": str(msg.content)}

        if msg.role == "assistant":
            text_content = msg_content.get("text", "") if isinstance(msg_content, dict) else str(msg_content)
            if not text_content or text_content.strip() == "":
                continue

        messages.append({
            "role": msg.role,
            "content": msg_content
        })

    # ========== 启动后台任务并订阅 ==========
    await chat_task_manager.start_execution(
        db=db,
        task=task,
        session=session,
        ai_message=ai_message,
        messages=messages,
        model=model,
        use_agent=use_agent,
        enable_thinking=enable_thinking,
    )

    # 订阅事件
    queue = await chat_task_manager.subscribe(task.id)

    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                yield event

                # 检查是否完成
                if event.get("event") in ["complete", "error"]:
                    break
            except asyncio.TimeoutError:
                # 发送心跳
                yield {"event": "heartbeat", "data": "{}"}
    finally:
        await chat_task_manager.unsubscribe(task.id, queue)


# 保留旧端点兼容性
@router.post("/agent/stream")
async def agent_stream(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Agent 聊天流（已弃用，请使用 /stream 并设置 useAgent=true）

    保留此端点以保持向后兼容。
    """
    request.useAgent = True
    return await chat_stream(request, user_id, db)