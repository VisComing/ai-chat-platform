"""
Chat Task Service - 后台聊天任务服务

实现聊天生成任务的后台执行和 SSE 广播机制，
支持刷新页面后重新订阅正在进行的任务。
"""
import asyncio
import json
import logging
import time
from datetime import datetime
from typing import AsyncGenerator, Dict, List, Optional, Any

from app.models import Session, Message, ChatTask
from app.services.agent_service import agent_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class ChatTaskManager:
    """
    聊天任务管理器

    管理 ChatTask 的生命周期和 SSE 事件广播。
    使用内存队列实现多订阅者广播。
    """

    def __init__(self):
        # 任务事件队列：{task_id: [queue1, queue2, ...]}
        self._event_queues: Dict[str, List[asyncio.Queue]] = {}
        # 运行中的任务：{task_id: asyncio.Task}
        self._running_tasks: Dict[str, asyncio.Task] = {}
        # 任务锁
        self._locks: Dict[str, asyncio.Lock] = {}

    def _get_lock(self, task_id: str) -> asyncio.Lock:
        """获取或创建任务锁"""
        if task_id not in self._locks:
            self._locks[task_id] = asyncio.Lock()
        return self._locks[task_id]

    async def create_task(
        self,
        user_id: str,
        session_id: str,
        message_id: str,
    ) -> ChatTask:
        """创建新的聊天任务"""
        task = ChatTask(
            session_id=session_id,
            message_id=message_id,
            user_id=user_id,
            status="pending",
        )
        await task.insert()

        # 初始化事件队列
        self._event_queues[task.id] = []

        logger.info(f"[ChatTask] Created task {task.id} for message {message_id}")
        return task

    async def subscribe(self, task_id: str) -> asyncio.Queue:
        """
        订阅任务事件

        返回一个队列，订阅者可以从队列中获取事件。
        """
        if task_id not in self._event_queues:
            self._event_queues[task_id] = []

        queue = asyncio.Queue()
        self._event_queues[task_id].append(queue)

        logger.debug(f"[ChatTask] New subscriber for task {task_id}, total: {len(self._event_queues[task_id])}")
        return queue

    async def unsubscribe(self, task_id: str, queue: asyncio.Queue):
        """取消订阅"""
        if task_id in self._event_queues:
            try:
                self._event_queues[task_id].remove(queue)
                logger.debug(f"[ChatTask] Unsubscribed from task {task_id}, remaining: {len(self._event_queues[task_id])}")
            except ValueError:
                pass

    async def broadcast(self, task_id: str, event: dict):
        """
        广播事件给所有订阅者

        event: {"event": str, "data": dict}
        """
        if task_id not in self._event_queues:
            return

        for queue in self._event_queues[task_id]:
            try:
                await queue.put(event)
            except Exception as e:
                logger.error(f"[ChatTask] Error broadcasting to queue: {e}")

    async def start_execution(
        self,
        task: ChatTask,
        session: Session,
        ai_message: Message,
        messages: List[Dict[str, Any]],
        model: str,
        enable_search: bool = True,
        enable_thinking: bool = False,
    ):
        """
        启动后台任务执行

        不阻塞调用者，任务在后台运行。
        """
        task.status = "running"
        await task.save()

        # 创建后台任务
        async_task = asyncio.create_task(
            self._execute_chat(
                task=task,
                session=session,
                ai_message=ai_message,
                messages=messages,
                model=model,
                enable_search=enable_search,
                enable_thinking=enable_thinking,
            )
        )
        self._running_tasks[task.id] = async_task

        # 添加完成回调
        async_task.add_done_callback(
            lambda _: self._on_task_complete(task.id)
        )

        logger.info(f"[ChatTask] Started background execution for task {task.id}")

    async def _execute_chat(
        self,
        task: ChatTask,
        session: Session,
        ai_message: Message,
        messages: List[Dict[str, Any]],
        model: str,
        enable_search: bool,
        enable_thinking: bool,
    ):
        """
        执行聊天生成任务

        统一调用 agent_service.chat
        """
        accumulated_text = ""
        accumulated_thinking = ""
        start_time = time.time()
        all_sources = []

        try:
            # 统一调用 agent_service（传递 session_id 用于多轮对话状态）
            async for event in agent_service.chat(
                messages=messages,
                model=model,
                enable_search=enable_search,
                enable_thinking=enable_thinking,
                session_id=session.id,
            ):
                # 检查任务是否被取消
                if task.status == "cancelled":
                    return

                event_type = event.get("event")
                event_data = event.get("data", {})

                # 处理不同事件类型
                if event_type == "text":
                    chunk = event_data.get("content", "")
                    accumulated_text += chunk

                    # 定期更新数据库
                    if len(accumulated_text) % 50 == 0:
                        ai_message.content = {"type": "text", "text": accumulated_text}
                        await ai_message.save()

                    broadcast_event = {
                        "event": "text",
                        "data": json.dumps({
                            "type": "text",
                            "content": chunk,
                            "messageId": ai_message.id,
                        }, ensure_ascii=False),
                    }
                    await self.broadcast(task.id, broadcast_event)

                elif event_type == "thinking":
                    chunk = event_data.get("content", "")
                    accumulated_thinking += chunk

                    broadcast_event = {
                        "event": "thinking",
                        "data": json.dumps({
                            "type": "thinking",
                            "content": chunk,
                            "iteration": event_data.get("iteration"),
                            "messageId": ai_message.id,
                        }, ensure_ascii=False),
                    }
                    await self.broadcast(task.id, broadcast_event)

                elif event_type == "tool_call":
                    query = event_data.get("query", "")
                    iteration = event_data.get("iteration")

                    broadcast_event = {
                        "event": "tool_call",
                        "data": json.dumps({
                            "type": "tool_call",
                            "tool": event_data.get("tool", "web_search"),
                            "toolName": event_data.get("toolName", "web_search"),
                            "query": query,
                            "toolArgs": event_data.get("toolArgs", {"query": query}),
                            "iteration": iteration,
                            "messageId": ai_message.id,
                        }, ensure_ascii=False),
                    }
                    await self.broadcast(task.id, broadcast_event)

                elif event_type == "search_result":
                    sources = event_data.get("sources", [])
                    all_sources.extend(sources)

                    broadcast_event = {
                        "event": "search_result",
                        "data": json.dumps({
                            "type": "search_result",
                            "query": event_data.get("query", ""),
                            "sources": sources,
                            "resultCount": len(sources),
                            "iteration": event_data.get("iteration"),
                            "messageId": ai_message.id,
                        }, ensure_ascii=False),
                    }
                    await self.broadcast(task.id, broadcast_event)

                elif event_type == "complete":
                    search_used = event_data.get("search_used", False)
                    sources = event_data.get("sources", [])
                    citations = event_data.get("citations", [])

                    # 保存最终消息
                    ai_message.content = {"type": "text", "text": accumulated_text}
                    ai_message.status = "completed"
                    ai_message.meta = {
                        "model": model,
                        "tokens": {
                            "input": sum(len(str(m.get("content", ""))) for m in messages) // 4,
                            "output": len(accumulated_text) // 4,
                        },
                        "duration": time.time() - start_time,
                        "search_used": search_used,
                        "sources": sources,
                        "citations": citations,
                    }
                    if accumulated_thinking:
                        ai_message.meta["thinking"] = accumulated_thinking
                    await ai_message.save()

                    # 更新会话
                    session.message_count += 1
                    session.last_message_at = datetime.utcnow()
                    await session.save()

                    # 发送 complete 事件
                    broadcast_event = {
                        "event": "complete",
                        "data": json.dumps({
                            "type": "complete",
                            "messageId": ai_message.id,
                            "search_used": search_used,
                            "sources": sources,
                            "citations": citations,
                            "meta": ai_message.meta,
                            "iterations": event_data.get("iterations", 0),
                        }, ensure_ascii=False),
                    }
                    await self.broadcast(task.id, broadcast_event)

                    # 异步生成标题
                    if session.message_count == 2 and session.title == "新对话":
                        raw_content = messages[0].get("content", "") if messages else ""
                        if isinstance(raw_content, dict):
                            user_msg_text = raw_content.get("text", str(raw_content))
                        else:
                            user_msg_text = str(raw_content)

                        logger.info(f"[ChatTask] Starting title generation for session {session.id}")
                        asyncio.create_task(
                            self._generate_title_async(
                                task_id=task.id,
                                session_id=session.id,
                                user_message=user_msg_text,
                                ai_response=accumulated_text,
                            )
                        )

                elif event_type == "error":
                    error_msg = event_data.get("content", "Unknown error")
                    ai_message.content = {"type": "text", "text": f"错误: {error_msg}"}
                    ai_message.status = "error"
                    await ai_message.save()

                    broadcast_event = {
                        "event": "error",
                        "data": json.dumps({
                            "type": "error",
                            "content": error_msg,
                            "messageId": ai_message.id,
                        }, ensure_ascii=False),
                    }
                    await self.broadcast(task.id, broadcast_event)

            # 任务完成
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            await task.save()

        except asyncio.CancelledError:
            logger.info(f"[ChatTask] Task {task.id} was cancelled")
            task.status = "cancelled"
            task.completed_at = datetime.utcnow()
            await task.save()

        except Exception as e:
            logger.error(f"[ChatTask] Task {task.id} failed: {e}")
            task.status = "failed"
            task.error_message = str(e)
            task.completed_at = datetime.utcnow()
            await task.save()

            ai_message.content = {"type": "text", "text": f"服务错误: {str(e)}"}
            ai_message.status = "error"
            await ai_message.save()

            await self.broadcast(task.id, {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "content": str(e),
                    "messageId": ai_message.id,
                }, ensure_ascii=False),
            })

    async def _generate_title_async(
        self,
        task_id: str,
        session_id: str,
        user_message: str,
        ai_response: str,
    ):
        """
        异步生成标题并广播事件

        作为后台任务执行，不阻塞主流程。
        """
        logger.info(f"[ChatTask] _generate_title_async started for task {task_id}")
        try:
            # 使用 agent_service 生成标题
            title = await agent_service.generate_title(
                user_message=user_message,
                ai_response=ai_response,
            )

            logger.info(f"[ChatTask] Generated title: {title}")

            # 更新数据库
            session = await Session.find_one(Session.id == session_id)
            if session:
                session.title = title
                session.updated_at = datetime.utcnow()
                await session.save()

            # 广播 title 事件
            title_event = {
                "event": "title",
                "data": json.dumps({
                    "type": "title",
                    "title": title,
                    "sessionId": session_id,
                }, ensure_ascii=False),
            }
            await self.broadcast(task_id, title_event)
            logger.info(f"[ChatTask] Title event broadcasted for session {session_id}")

        except Exception as e:
            logger.error(f"[ChatTask] Title generation failed: {e}")

    def _on_task_complete(self, task_id: str):
        """任务完成回调"""
        if task_id in self._running_tasks:
            del self._running_tasks[task_id]
        logger.info(f"[ChatTask] Task {task_id} removed from running tasks")

    async def cancel_task(self, task_id: str) -> bool:
        """
        取消任务

        Returns:
            True if cancelled, False if task not running
        """
        if task_id in self._running_tasks:
            async_task = self._running_tasks[task_id]
            async_task.cancel()
            logger.info(f"[ChatTask] Cancelled running task {task_id}")
            return True

        # 更新数据库状态
        task = await ChatTask.find_one(ChatTask.id == task_id)
        if task and task.status in ["pending", "running"]:
            task.status = "cancelled"
            task.completed_at = datetime.utcnow()
            await task.save()
            logger.info(f"[ChatTask] Marked task {task_id} as cancelled")
            return True

        return False

    async def get_task_status(self, task_id: str) -> Optional[ChatTask]:
        """获取任务状态"""
        return await ChatTask.find_one(ChatTask.id == task_id)

    async def get_running_task_for_session(
        self,
        session_id: str,
        user_id: str,
    ) -> Optional[ChatTask]:
        """
        获取会话中正在运行的任务

        用于刷新页面后恢复订阅。
        """
        return await ChatTask.find(
            ChatTask.session_id == session_id,
            ChatTask.user_id == user_id,
            ChatTask.status == "running",
        ).sort("-created_at").first_or_none()

    async def cleanup_completed_tasks(self, max_age_hours: int = 24):
        """
        清理已完成的旧任务

        定期调用以防止任务表过大。
        """
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)

        old_tasks = await ChatTask.find(
            {"status": {"$in": ["completed", "failed", "cancelled"]}, "completed_at": {"$lt": cutoff}}
        ).to_list()

        for task in old_tasks:
            await task.delete()
            if task.id in self._event_queues:
                del self._event_queues[task.id]

        logger.info(f"[ChatTask] Cleaned up {len(old_tasks)} old tasks")


# 全局单例
chat_task_manager = ChatTaskManager()