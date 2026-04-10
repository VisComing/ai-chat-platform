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
from app.services.ai_service import ai_service
from app.services.agent_service import agent_service
from app.services.title_service import generate_and_push_title
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
        use_agent: bool = False,
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
                use_agent=use_agent,
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
        use_agent: bool,
        enable_thinking: bool,
    ):
        """
        执行聊天生成任务

        核心生成逻辑，同时广播事件和更新数据库。
        """
        accumulated_text = ""
        accumulated_thinking = ""
        start_time = time.time()

        try:
            if use_agent:
                async for event in self._stream_agent_response(
                    task=task,
                    session=session,
                    ai_message=ai_message,
                    messages=messages,
                    model=model,
                    enable_thinking=enable_thinking,
                ):
                    if event.get("accumulated_text"):
                        accumulated_text = event["accumulated_text"]
            else:
                async for event in self._stream_normal_response(
                    task=task,
                    session=session,
                    ai_message=ai_message,
                    messages=messages,
                    model=model,
                    enable_thinking=enable_thinking,
                ):
                    if event.get("accumulated_text"):
                        accumulated_text = event["accumulated_text"]

            # 生成标题
            if session.message_count == 2 and session.title == "新对话":
                raw_content = messages[0].get("content", "") if messages else ""
                if isinstance(raw_content, dict):
                    user_msg_text = raw_content.get("text", str(raw_content))
                else:
                    user_msg_text = str(raw_content)

                async for title_event in generate_and_push_title(
                    session_id=session.id,
                    user_message=user_msg_text,
                    ai_response=accumulated_text,
                ):
                    await self.broadcast(task.id, title_event)

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

    async def _stream_normal_response(
        self,
        task: ChatTask,
        session: Session,
        ai_message: Message,
        messages: List[Dict[str, Any]],
        model: str,
        enable_thinking: bool,
    ) -> AsyncGenerator[dict, None]:
        """普通聊天模式"""
        accumulated_text = ""
        accumulated_thinking = ""
        start_time = time.time()

        if ai_service.is_thinking_model(model):
            async for chunk in ai_service.chat_completion_with_thinking(messages, model=model):
                # 检查任务是否被取消
                if task.status == "cancelled":
                    return

                if chunk.type == "thinking":
                    accumulated_thinking += chunk.content
                    event = {
                        "event": "thinking",
                        "data": json.dumps({
                            "type": "thinking",
                            "content": chunk.content,
                            "messageId": ai_message.id,
                        }, ensure_ascii=False),
                    }
                    await self.broadcast(task.id, event)
                    yield event

                elif chunk.type == "text":
                    accumulated_text += chunk.content

                    # 定期更新数据库
                    if len(accumulated_text) % 50 == 0:
                        ai_message.content = {"type": "text", "text": accumulated_text}
                        await ai_message.save()

                    event = {
                        "event": "text",
                        "data": json.dumps({
                            "type": "text",
                            "content": chunk.content,
                            "messageId": ai_message.id,
                        }, ensure_ascii=False),
                    }
                    await self.broadcast(task.id, event)
                    yield event

                elif chunk.type == "error":
                    event = {
                        "event": "error",
                        "data": json.dumps({
                            "type": "error",
                            "content": chunk.content,
                            "messageId": ai_message.id,
                        }),
                    }
                    await self.broadcast(task.id, event)
                    yield event
                    return
        else:
            async for chunk in ai_service.chat_completion(messages, model=model):
                if task.status == "cancelled":
                    return

                accumulated_text += chunk

                if len(accumulated_text) % 50 == 0:
                    ai_message.content = {"type": "text", "text": accumulated_text}
                    await ai_message.save()

                event = {
                    "event": "text",
                    "data": json.dumps({
                        "type": "text",
                        "content": chunk,
                        "messageId": ai_message.id,
                    }, ensure_ascii=False),
                }
                await self.broadcast(task.id, event)
                yield event

        # 完成
        ai_message.content = {"type": "text", "text": accumulated_text}
        ai_message.status = "completed"
        ai_message.meta = {
            "model": model,
            "tokens": {
                "input": sum(len(str(m.get("content", ""))) for m in messages) // 4,
                "output": len(accumulated_text) // 4,
            },
            "duration": time.time() - start_time,
        }
        if accumulated_thinking:
            ai_message.meta["thinking"] = accumulated_thinking
        await ai_message.save()

        session.message_count += 1
        session.last_message_at = datetime.utcnow()
        await session.save()

        event = {
            "event": "complete",
            "data": json.dumps({
                "type": "complete",
                "messageId": ai_message.id,
                "meta": ai_message.meta,
                "hasThinking": bool(accumulated_thinking),
            }, ensure_ascii=False),
        }
        await self.broadcast(task.id, event)
        yield event
        yield {"accumulated_text": accumulated_text}

    async def _stream_agent_response(
        self,
        task: ChatTask,
        session: Session,
        ai_message: Message,
        messages: List[Dict[str, Any]],
        model: str,
        enable_thinking: bool,
    ) -> AsyncGenerator[dict, None]:
        """Agent 模式"""
        accumulated_text = ""
        start_time = time.time()

        async for event in agent_service.chat(messages, model=model, enable_thinking=enable_thinking):
            if task.status == "cancelled":
                return

            event_type = event.get("event")
            event_data = event.get("data", {})

            if event_type == "text":
                chunk = event_data.get("content", "")
                accumulated_text += chunk

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
                yield broadcast_event

            elif event_type == "tool_call":
                broadcast_event = {
                    "event": "tool_call",
                    "data": json.dumps({
                        "type": "tool_call",
                        "tool": "web_search",
                        "query": event_data.get("query", ""),
                        "messageId": ai_message.id,
                    }, ensure_ascii=False),
                }
                await self.broadcast(task.id, broadcast_event)
                yield broadcast_event

            elif event_type == "thinking":
                broadcast_event = {
                    "event": "thinking",
                    "data": json.dumps({
                        "type": "thinking",
                        "content": event_data.get("content", ""),
                        "status": event_data.get("status", ""),
                        "messageId": ai_message.id,
                    }, ensure_ascii=False),
                }
                await self.broadcast(task.id, broadcast_event)
                yield broadcast_event

            elif event_type == "complete":
                search_used = event_data.get("search_used", False)
                sources = event_data.get("sources", [])
                citations = event_data.get("citations", [])

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
                await ai_message.save()

                session.message_count += 1
                session.last_message_at = datetime.utcnow()
                await session.save()

                broadcast_event = {
                    "event": "complete",
                    "data": json.dumps({
                        "type": "complete",
                        "messageId": ai_message.id,
                        "search_used": search_used,
                        "sources": sources,
                        "citations": citations,
                        "meta": ai_message.meta,
                    }, ensure_ascii=False),
                }
                await self.broadcast(task.id, broadcast_event)
                yield broadcast_event

            elif event_type == "error":
                error_msg = event_data.get("content", "Unknown error")
                ai_message.content = {"type": "text", "text": f"Agent错误: {error_msg}"}
                ai_message.status = "error"
                await ai_message.save()

                broadcast_event = {
                    "event": "error",
                    "data": json.dumps({
                        "type": "error",
                        "content": error_msg,
                        "messageId": ai_message.id,
                    }),
                }
                await self.broadcast(task.id, broadcast_event)
                yield broadcast_event

        yield {"accumulated_text": accumulated_text}

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
        # Use find().sort().first_or_none() instead of find_one().sort()
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

        # Use proper Beanie $in operator syntax
        old_tasks = await ChatTask.find(
            {"status": {"$in": ["completed", "failed", "cancelled"]}, "completed_at": {"$lt": cutoff}}
        ).to_list()

        for task in old_tasks:
            await task.delete()
            # 清理事件队列
            if task.id in self._event_queues:
                del self._event_queues[task.id]

        logger.info(f"[ChatTask] Cleaned up {len(old_tasks)} old tasks")


# 全局单例
chat_task_manager = ChatTaskManager()