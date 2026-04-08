"""
Unified Chat Service - Combines normal chat and agent chat
"""
import json
import time
import logging
import base64
import os
import re
from datetime import datetime
from typing import AsyncGenerator, List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Session, Message, File
from app.services.ai_service import ai_service
from app.services.agent_service import agent_service
from app.services.title_service import generate_and_push_title

logger = logging.getLogger(__name__)


async def resolve_image_urls(
    db: AsyncSession,
    content: dict,
    user_id: str
) -> dict:
    """
    Resolve image URLs in message content to base64 data URIs

    Converts /api/v1/files/{id}/download paths to actual file paths
    and then to base64 for AI API consumption.
    """
    if not isinstance(content, dict):
        return content

    content_type = content.get("type", "text")
    if content_type == "text":
        return content

    parts = content.get("parts", [])
    if not parts:
        return content

    resolved_parts = []
    for part in parts:
        if part.get("type") == "image":
            url = part.get("url", "")

            # Check if already a data URI or remote URL
            if url.startswith("data:") or url.startswith("http"):
                resolved_parts.append(part)
                continue

            # Try to extract file_id from URL like /api/v1/files/{id}/download
            file_id_match = re.search(r'/files/([^/]+)', url)
            if file_id_match:
                file_id = file_id_match.group(1)

                # Query database for file path
                try:
                    result = await db.execute(
                        select(File).where(File.id == file_id, File.user_id == user_id)
                    )
                    file_record = result.scalar_one_or_none()

                    if file_record and os.path.exists(file_record.path):
                        # Read file and convert to base64
                        with open(file_record.path, 'rb') as f:
                            image_data = f.read()

                        ext = os.path.splitext(file_record.path)[1].lower()
                        mime_map = {
                            '.jpg': 'image/jpeg',
                            '.jpeg': 'image/jpeg',
                            '.png': 'image/png',
                            '.gif': 'image/gif',
                            '.webp': 'image/webp',
                        }
                        mime_type = mime_map.get(ext, file_record.mime_type or 'image/jpeg')

                        b64_data = base64.b64encode(image_data).decode('utf-8')
                        b64_uri = f"data:{mime_type};base64,{b64_data}"

                        resolved_parts.append({
                            **part,
                            "url": b64_uri
                        })
                        logger.info(f"[Chat] Resolved image {file_id} to base64")
                    else:
                        logger.warning(f"[Chat] File not found: {file_id}")
                        resolved_parts.append(part)  # Keep original
                except Exception as e:
                    logger.error(f"[Chat] Error resolving image {file_id}: {e}")
                    resolved_parts.append(part)
            else:
                resolved_parts.append(part)
        else:
            resolved_parts.append(part)

    return {**content, "parts": resolved_parts}


async def stream_chat(
    db: AsyncSession,
    user_id: str,
    session_id: str | None,
    content: dict,
    model: str | None,
    use_agent: bool = False,
    enable_thinking: bool = False,
) -> AsyncGenerator[dict, None]:
    """
    Unified chat stream - supports both normal and agent mode

    Args:
        db: Database session
        user_id: Current user ID
        session_id: Session ID (optional, will create if None)
        content: User message content
        model: AI model to use
        use_agent: Whether to use agent mode (with search capability)
        enable_thinking: Whether to enable deep thinking mode (for qwen3-max, etc.)

    Yields:
        SSE event dictionaries
    """
    model = model or settings.default_model

    # ========== Session Management ==========
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
            # Create new session if not found
            logger.warning(f"[Chat] Session {session_id} not found, creating new")
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

    # ========== Create User Message ==========
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

    # ========== Create AI Message Placeholder ==========
    ai_message = Message(
        session_id=session_id,
        role="assistant",
        content={"type": "text", "text": ""},
        status="streaming",
    )
    db.add(ai_message)
    await db.flush()
    await db.commit()  # Commit immediately to persist the message

    message_id = ai_message.id

    # ========== Get Conversation History ==========
    # Exclude the placeholder AI message we just created (id == message_id)
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id, Message.id != message_id)
        .order_by(Message.created_at)
        .limit(20)
    )
    history_messages = result.scalars().all()

    logger.info(f"[Chat] History messages count: {len(history_messages)}, excluded message_id: {message_id}")
    for msg in history_messages:
        logger.debug(f"[Chat] History msg: id={msg.id}, role={msg.role}, content_preview={str(msg.content)[:50]}")

    messages: List[Dict[str, Any]] = []
    for msg in history_messages:
        msg_content = msg.content if isinstance(msg.content, dict) else {"type": "text", "text": str(msg.content)}

        # Skip empty assistant messages
        if msg.role == "assistant":
            text_content = msg_content.get("text", "") if isinstance(msg_content, dict) else str(msg_content)
            if not text_content or text_content.strip() == "":
                logger.info(f"[Chat] Skipping empty assistant message: id={msg.id}")
                continue

        # Resolve image URLs to base64 for AI API consumption
        msg_content = await resolve_image_urls(db, msg_content, user_id)

        messages.append({
            "role": msg.role,
            "content": msg_content
        })

    # ========== Stream Response ==========
    try:
        start_time = time.time()
        accumulated_text = ""

        # Use agent mode for search capability, combined with thinking if enabled
        actual_use_agent = use_agent

        if actual_use_agent:
            # Agent mode with search capability
            async for event in _stream_agent_response(
                db=db,
                session=session,
                ai_message=ai_message,
                messages=messages,
                model=model,
                session_id=session_id,
                message_id=message_id,
                enable_thinking=enable_thinking,
            ):
                if event.get("accumulated_text"):
                    accumulated_text = event["accumulated_text"]
                else:
                    yield event
        else:
            # Normal chat mode
            async for event in _stream_normal_response(
                db=db,
                session=session,
                ai_message=ai_message,
                messages=messages,
                model=model,
                session_id=session_id,
                message_id=message_id,
                enable_thinking=enable_thinking,
            ):
                if event.get("accumulated_text"):
                    accumulated_text = event["accumulated_text"]
                else:
                    yield event

        # ========== Generate Title ==========
        if session.message_count == 2 and session.title == "新对话":
            # 提取用户消息内容（处理字典格式）
            raw_content = messages[0].get("content", "") if messages else ""
            if isinstance(raw_content, dict):
                user_msg_text = raw_content.get("text", str(raw_content))
            else:
                user_msg_text = str(raw_content)
            async for title_event in generate_and_push_title(
                session_id=session_id,
                user_message=user_msg_text,
                ai_response=accumulated_text,
            ):
                yield title_event

    except Exception as e:
        logger.error(f"[Chat] Error: {e}")
        ai_message.content = {"type": "text", "text": f"服务错误: {str(e)}"}
        ai_message.status = "error"
        await db.commit()

        yield {
            "event": "error",
            "data": json.dumps({
                "type": "error",
                "content": str(e),
                "messageId": message_id,
            }),
        }


async def _stream_normal_response(
    db: AsyncSession,
    session: Session,
    ai_message: Message,
    messages: List[Dict[str, Any]],
    model: str,
    session_id: str,
    message_id: str,
    enable_thinking: bool = False,
) -> AsyncGenerator[dict, None]:
    """Stream normal chat response with deep thinking support"""
    accumulated_text = ""
    accumulated_thinking = ""
    start_time = time.time()

    # For thinking-capable models, always use thinking-aware completion
    # The model may return reasoning_content regardless of enable_thinking flag
    if ai_service.is_thinking_model(model):
        # Use thinking-aware completion - will process reasoning_content if present
        async for chunk in ai_service.chat_completion_with_thinking(messages, model=model):
            if chunk.type == "thinking":
                accumulated_thinking += chunk.content

                # Send thinking event
                yield {
                    "event": "thinking",
                    "data": json.dumps({
                        "type": "thinking",
                        "content": chunk.content,
                        "messageId": message_id,
                    }, ensure_ascii=False),
                }

            elif chunk.type == "text":
                accumulated_text += chunk.content

                # Update DB periodically
                if len(accumulated_text) % 50 == 0:
                    ai_message.content = {"type": "text", "text": accumulated_text}
                    await db.commit()

                yield {
                    "event": "text",
                    "data": json.dumps({
                        "type": "text",
                        "content": chunk.content,
                        "messageId": message_id,
                    }, ensure_ascii=False),
                }

            elif chunk.type == "error":
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "type": "error",
                        "content": chunk.content,
                        "messageId": message_id,
                    }),
                }
                return
    else:
        # Normal completion for non-thinking models
        async for chunk in ai_service.chat_completion(messages, model=model):
            accumulated_text += chunk

            # Update DB periodically
            if len(accumulated_text) % 50 == 0:
                ai_message.content = {"type": "text", "text": accumulated_text}
                await db.commit()

            yield {
                "event": "text",
                "data": json.dumps({
                    "type": "text",
                    "content": chunk,
                    "messageId": message_id,
                }, ensure_ascii=False),
            }

    # Mark complete
    ai_message.content = {"type": "text", "text": accumulated_text}
    ai_message.status = "completed"
    ai_message.meta = {
        "model": model,
        "tokens": {
            "input": sum(len(m.get("content", "")) for m in messages) // 4,
            "output": len(accumulated_text) // 4,
        },
        "duration": time.time() - start_time,
    }

    # Include thinking in metadata if present
    if accumulated_thinking:
        ai_message.meta["thinking"] = accumulated_thinking

    session.message_count += 1
    session.last_message_at = datetime.utcnow()
    await db.commit()

    yield {
        "event": "complete",
        "data": json.dumps({
            "type": "complete",
            "messageId": message_id,
            "meta": ai_message.meta,
            "hasThinking": bool(accumulated_thinking),
        }, ensure_ascii=False),
    }

    yield {"accumulated_text": accumulated_text}


async def _stream_agent_response(
    db: AsyncSession,
    session: Session,
    ai_message: Message,
    messages: List[Dict[str, Any]],
    model: str,
    session_id: str,
    message_id: str,
    enable_thinking: bool = False,
) -> AsyncGenerator[dict, None]:
    """Stream agent chat response with search capability and optional deep thinking"""
    accumulated_text = ""
    accumulated_thinking = ""
    start_time = time.time()

    # Note: We don't send initial "analyzing" status anymore.
    # The agent will decide whether to show thinking status based on its processing.
    # For simple greetings, the agent should respond directly without any intermediate status.

    async for event in agent_service.chat(messages, model=model, enable_thinking=enable_thinking):
        event_type = event.get("event")
        event_data = event.get("data", {})

        if event_type == "text":
            chunk = event_data.get("content", "")
            accumulated_text += chunk

            # Update DB periodically
            if len(accumulated_text) % 50 == 0:
                ai_message.content = {"type": "text", "text": accumulated_text}
                await db.commit()

            yield {
                "event": "text",
                "data": json.dumps({
                    "type": "text",
                    "content": chunk,
                    "messageId": message_id,
                }, ensure_ascii=False),
            }

        elif event_type == "tool_call":
            yield {
                "event": "tool_call",
                "data": json.dumps({
                    "type": "tool_call",
                    "tool": "web_search",
                    "query": event_data.get("query", ""),
                    "messageId": message_id,
                }, ensure_ascii=False),
            }

        elif event_type == "thinking":
            yield {
                "event": "thinking",
                "data": json.dumps({
                    "type": "thinking",
                    "content": event_data.get("content", ""),
                    "status": event_data.get("status", ""),
                    "messageId": message_id,
                }, ensure_ascii=False),
            }

        elif event_type == "complete":
            search_used = event_data.get("search_used", False)
            sources = event_data.get("sources", [])
            citations = event_data.get("citations", [])

            ai_message.content = {"type": "text", "text": accumulated_text}
            ai_message.status = "completed"
            ai_message.meta = {
                "model": model,
                "tokens": {
                    "input": sum(len(m.get("content", "")) for m in messages) // 4,
                    "output": len(accumulated_text) // 4,
                },
                "duration": time.time() - start_time,
                "search_used": search_used,
                "sources": sources,  # 传递 sources 给前端
                "citations": citations,
            }
            session.message_count += 1
            session.last_message_at = datetime.utcnow()
            await db.commit()

            yield {
                "event": "complete",
                "data": json.dumps({
                    "type": "complete",
                    "messageId": message_id,
                    "search_used": search_used,
                    "sources": sources,  # 传递 sources 给前端
                    "citations": citations,
                    "meta": ai_message.meta,
                }, ensure_ascii=False),
            }

        elif event_type == "error":
            error_msg = event_data.get("content", "Unknown error")
            ai_message.content = {"type": "text", "text": f"Agent错误: {error_msg}"}
            ai_message.status = "error"
            await db.commit()

            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "content": error_msg,
                    "messageId": message_id,
                }),
            }

    yield {"accumulated_text": accumulated_text}