"""
MongoDB Span Exporter - 将 OpenTelemetry span 导出到 MongoDB

自定义 SpanExporter，将 traceloop 收集的 LLM 调用数据转换为 ModelTrace 格式存储。

使用方式：
1. 在 agent_service.chat 开始时设置关联属性：
   Traceloop.set_association_properties({
       "user_id": user_id,
       "session_id": session_id,
       "message_id": message_id,
   })

2. Traceloop.init() 时使用此 exporter

3. LangChain/LangGraph 调用自动被追踪，span 完成后导出到 MongoDB
"""
import asyncio
import json
import logging
from typing import Sequence, Optional, Dict, Any
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.trace import ReadableSpan

from app.models.model_trace import ModelTrace

logger = logging.getLogger(__name__)


# OpenTelemetry 语义约定属性（traceloop 使用）
ATTR_MODEL_NAME = "gen_ai.request.model"
ATTR_PROVIDER_NAME = "gen_ai.provider.name"
ATTR_PROMPT_TOKENS = "gen_ai.usage.prompt_tokens"  # 或 gen_ai.usage.input_tokens
ATTR_COMPLETION_TOKENS = "gen_ai.usage.completion_tokens"  # 或 gen_ai.usage.output_tokens
ATTR_REQUEST_MESSAGES = "gen_ai.input.messages"
ATTR_RESPONSE_MESSAGES = "gen_ai.output.messages"
ATTR_TEMPERATURE = "gen_ai.request.temperature"
ATTR_MAX_TOKENS = "gen_ai.request.max_tokens"

# 自定义关联属性（通过 Traceloop.set_association_properties 设置）
ATTR_USER_ID = "traceloop.association.properties.user_id"
ATTR_SESSION_ID = "traceloop.association.properties.session_id"
ATTR_MESSAGE_ID = "traceloop.association.properties.message_id"


class MongoDBSpanExporter(SpanExporter):
    """
    将 OpenTelemetry span 导出到 MongoDB

    只处理 LLM/GenAI 相关的 span，提取关联属性和调用信息存储为 ModelTrace。
    """

    def __init__(self):
        self._shutdown = False

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        """导出 span 到 MongoDB"""
        logger.info(f"[MongoDBExporter] export called with {len(spans)} spans")

        if self._shutdown:
            return SpanExportResult.FAILURE

        for span in spans:
            try:
                self._process_span(span)
            except Exception as e:
                logger.error(f"[MongoDBExporter] Error processing span: {e}")

        return SpanExportResult.SUCCESS

    def _process_span(self, span: ReadableSpan):
        """处理单个 span"""
        attributes = dict(span.attributes or {})

        logger.info(f"[MongoDBExporter] Processing span: name={span.name}, attributes keys={list(attributes.keys())}")

        # 提取关联属性
        user_id = attributes.get(ATTR_USER_ID)
        session_id = attributes.get(ATTR_SESSION_ID)
        message_id = attributes.get(ATTR_MESSAGE_ID)

        logger.info(f"[MongoDBExporter] Association: user_id={user_id}, session_id={session_id}, message_id={message_id}")

        # 必须有关联属性才能保存（否则无法关联到用户对话）
        if not user_id or not session_id or not message_id:
            logger.debug(f"[MongoDBExporter] Span missing association properties: {span.name}")
            return

        # 检查是否是 LLM 调用 span
        span_name = span.name or ""
        # traceloop 的 LLM span name 格式: "openai.chat", "anthropic.messages" 等
        if not any(keyword in span_name.lower() for keyword in ["llm", "gen_ai", "openai", "anthropic", "chat", "completion"]):
            logger.debug(f"[MongoDBExporter] Span not LLM related: {span_name}")
            return

        # 提取模型信息
        model = attributes.get(ATTR_MODEL_NAME) or self._extract_model_from_span_name(span_name)

        # 提取 provider（从属性或 span name）
        provider = attributes.get(ATTR_PROVIDER_NAME) or self._extract_provider_from_span_name(span_name)

        # 计算耗时
        duration_ms = 0
        if span.start_time and span.end_time:
            duration_ms = int((span.end_time - span.start_time) / 1_000_000)

        # 提取 token 使用（支持多种属性名）
        token_input = attributes.get(ATTR_PROMPT_TOKENS) or attributes.get("gen_ai.usage.input_tokens")
        token_output = attributes.get(ATTR_COMPLETION_TOKENS) or attributes.get("gen_ai.usage.output_tokens")
        if token_input is not None:
            token_input = int(token_input)
        if token_output is not None:
            token_output = int(token_output)

        # 提取请求消息
        request_messages = []
        raw_messages = attributes.get(ATTR_REQUEST_MESSAGES)
        if raw_messages:
            try:
                request_messages = json.loads(raw_messages) if isinstance(raw_messages, str) else raw_messages
            except Exception:
                request_messages = []

        # 提取响应内容（从 output.messages）
        response_content = ""
        raw_response = attributes.get(ATTR_RESPONSE_MESSAGES)
        if raw_response:
            try:
                response_data = json.loads(raw_response) if isinstance(raw_response, str) else raw_response
                if isinstance(response_data, list) and len(response_data) > 0:
                    # 提取第一条消息的内容
                    first_msg = response_data[0]
                    if isinstance(first_msg, dict):
                        response_content = first_msg.get("content", "")
            except Exception:
                response_content = str(raw_response)[:2000]
        if isinstance(response_content, str) and len(response_content) > 2000:
            response_content = response_content[:2000]  # 限制长度

        # 提取请求参数
        request_params = {
            "temperature": attributes.get(ATTR_TEMPERATURE),
            "max_tokens": attributes.get(ATTR_MAX_TOKENS),
        }

        # 状态
        status = "completed"
        error_message = None
        if span.status and span.status.status_code.name == "ERROR":
            status = "error"
            error_message = span.status.description

        # 异步保存到 MongoDB
        asyncio.create_task(
            self._save_trace(
                user_id=str(user_id),
                session_id=str(session_id),
                message_id=str(message_id),
                model=str(model),
                provider=str(provider),
                request_messages=request_messages,
                request_params=request_params,
                response_content=response_content,
                duration_ms=duration_ms,
                token_input=token_input,
                token_output=token_output,
                status=status,
                error_message=error_message,
            )
        )

        logger.info(f"[MongoDBExporter] Saving trace: model={model}, duration={duration_ms}ms, tokens={token_input}/{token_output}")

    def _extract_model_from_span_name(self, span_name: str) -> str:
        """从 span name 提取模型名称"""
        # traceloop span name 格式: "llm.call.openai.gpt-4" 或类似
        parts = span_name.split(".")
        if len(parts) >= 3:
            return parts[-1]
        return "unknown"

    def _extract_provider_from_span_name(self, span_name: str) -> str:
        """从 span name 提取 provider"""
        span_lower = span_name.lower()
        if "bailian" in span_lower or "aliyun" in span_lower:
            return "bailian"
        if "deepseek" in span_lower:
            return "deepseek"
        if "openai" in span_lower:
            return "openai"
        if "anthropic" in span_lower:
            return "anthropic"
        return "unknown"

    async def _save_trace(
        self,
        user_id: str,
        session_id: str,
        message_id: str,
        model: str,
        provider: str,
        request_messages: list,
        request_params: dict,
        response_content: str,
        duration_ms: int,
        token_input: Optional[int],
        token_output: Optional[int],
        status: str,
        error_message: Optional[str],
    ):
        """保存 trace 到 MongoDB"""
        try:
            trace = ModelTrace(
                user_id=user_id,
                session_id=session_id,
                message_id=message_id,
                model=model,
                api_provider=provider,
                request_messages=request_messages,
                request_params=request_params,
                response_content=response_content,
                duration_ms=duration_ms,
                token_input=token_input,
                token_output=token_output,
                status=status,
                error_message=error_message,
            )
            await trace.insert()
            logger.info(f"[MongoDBExporter] Saved trace: {trace.id}")
        except Exception as e:
            logger.error(f"[MongoDBExporter] Failed to save trace: {e}", exc_info=True)

    def shutdown(self) -> None:
        """关闭 exporter"""
        self._shutdown = True

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        """强制刷新"""
        return True


# 单例实例
mongodb_span_exporter = MongoDBSpanExporter()