"""
Model Trace Service - 模型调用追踪服务

通过 HTTP 客户端拦截底层 API 请求和响应，记录模型调用追踪。
"""
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from contextvars import ContextVar

import httpx

from app.models.model_trace import ModelTrace

logger = logging.getLogger(__name__)


# ============================================================================
# Trace 数据结构
# ============================================================================

@dataclass
class TraceContext:
    """
    Trace 上下文，用于传递追踪所需的信息

    包含用户对话的关联信息，用于将 trace 记录与用户对话关联。
    """
    user_id: str
    session_id: str
    message_id: str  # 对应的 assistant message
    model: str = ""
    api_provider: str = ""
    enable_thinking: bool = False
    enable_search: bool = False


# ContextVar 用于传递 trace_context 到 HTTP hook
_trace_context_var: ContextVar[Optional[TraceContext]] = ContextVar("trace_context", default=None)

# 当前请求的 trace 数据（用于流式响应累加）
_current_request_trace: ContextVar[Dict[str, Any]] = ContextVar("current_request_trace", default={})


# ============================================================================
# Tracing HTTP Client
# ============================================================================

class TracingHTTPClient(httpx.AsyncClient):
    """
    带有 Trace 功能的 HTTP 客户端

    通过 event_hooks 拦截请求和响应，记录模型 API 调用。
    """

    def __init__(self, **kwargs):
        # 设置 event_hooks
        event_hooks = kwargs.pop("event_hooks", {})
        event_hooks.setdefault("request", []).append(self._on_request)
        event_hooks.setdefault("response", []).append(self._on_response)

        super().__init__(event_hooks=event_hooks, **kwargs)

    async def _on_request(self, request: httpx.Request):
        """请求发送前的 hook"""
        # 只拦截 chat/completions API
        if "/chat/completions" not in str(request.url):
            return

        trace_context = _trace_context_var.get()
        if not trace_context:
            return

        # 记录请求信息
        request_data = {
            "trace_context": trace_context,
            "start_time": time.time(),
            "url": str(request.url),
            "method": request.method,
            "request_body": None,
            "request_headers": {},
        }

        # 解析请求 body
        try:
            if request.content:
                request_data["request_body"] = json.loads(request.content.decode("utf-8"))
        except Exception:
            request_data["request_body"] = request.content

        # 保存到 contextvar
        _current_request_trace.set(request_data)
        logger.debug(f"[Trace] Request started: url={request.url}")

    async def _on_response(self, response: httpx.Response):
        """响应返回后的 hook"""
        # 只拦截 chat/completions API
        if "/chat/completions" not in str(response.url):
            return

        request_trace = _current_request_trace.get()
        if not request_trace:
            return

        trace_context = request_trace.get("trace_context")
        if not trace_context:
            return

        end_time = time.time()
        duration_ms = int((end_time - request_trace.get("start_time", end_time)) * 1000)

        # 解析响应
        response_body = None
        try:
            # 对于流式响应，response.content 可能是空的
            # 但 httpx 的 response hook 在响应完成后执行，content 应该已经读取完毕
            if response.content:
                response_body = json.loads(response.content.decode("utf-8"))
        except Exception as e:
            logger.debug(f"[Trace] Failed to parse response: {e}")
            response_body = {"raw": response.content}

        # 提取请求和响应的关键信息
        request_body = request_trace.get("request_body", {})
        model = request_body.get("model", trace_context.model)
        messages = request_body.get("messages", [])
        stream = request_body.get("stream", False)

        # 提取响应内容
        response_content = ""
        response_reasoning = None
        status = "completed"
        error_message = None
        token_input = None
        token_output = None

        if response_body:
            if "error" in response_body:
                status = "error"
                error_message = response_body.get("error", {}).get("message", str(response_body.get("error")))
            elif "choices" in response_body:
                # 非流式响应
                choices = response_body.get("choices", [])
                if choices:
                    message = choices[0].get("message", {})
                    response_content = message.get("content", "")
                    # 尝试获取 reasoning_content
                    response_reasoning = message.get("reasoning_content")

                # 获取 token 使用情况
                usage = response_body.get("usage", {})
                token_input = usage.get("prompt_tokens")
                token_output = usage.get("completion_tokens")

        # 异步保存 trace
        asyncio.create_task(
            self._save_trace_async(
                trace_context=trace_context,
                model=model,
                request_messages=messages,
                request_params={
                    "temperature": request_body.get("temperature"),
                    "max_tokens": request_body.get("max_tokens"),
                    "stream": stream,
                    "enable_thinking": trace_context.enable_thinking,
                    "enable_search": trace_context.enable_search,
                },
                response_content=response_content,
                response_reasoning=response_reasoning,
                duration_ms=duration_ms,
                token_input=token_input,
                token_output=token_output,
                status=status,
                error_message=error_message,
            )
        )

        logger.debug(f"[Trace] Response received: model={model}, duration={duration_ms}ms")

    async def _save_trace_async(
        self,
        trace_context: TraceContext,
        model: str,
        request_messages: List[Dict],
        request_params: Dict,
        response_content: str,
        response_reasoning: Optional[str],
        duration_ms: int,
        token_input: Optional[int],
        token_output: Optional[int],
        status: str,
        error_message: Optional[str],
    ):
        """异步保存 trace"""
        try:
            trace = ModelTrace(
                user_id=trace_context.user_id,
                session_id=trace_context.session_id,
                message_id=trace_context.message_id,
                model=model,
                api_provider=trace_context.api_provider,
                request_messages=request_messages,
                request_params=request_params,
                response_content=response_content,
                response_reasoning=response_reasoning,
                duration_ms=duration_ms,
                token_input=token_input,
                token_output=token_output,
                status=status,
                error_message=error_message,
            )
            await trace.insert()
            logger.info(f"[Trace] Saved HTTP trace: model={model}, duration={duration_ms}ms, tokens={token_input}/{token_output}")
        except Exception as e:
            logger.error(f"[Trace] Failed to save trace: {e}", exc_info=True)


# ============================================================================
# Trace 服务
# ============================================================================

class TraceService:
    """模型调用追踪服务"""

    def __init__(self):
        self.default_temperature = 0.7
        self.max_tokens = 4096

    def create_tracing_client(self, proxy: Optional[str] = None, timeout: float = 60.0) -> TracingHTTPClient:
        """
        创建带有 Trace 功能的 HTTP 客户端

        Args:
            proxy: 代理地址
            timeout: 超时时间

        Returns:
            TracingHTTPClient 实例
        """
        if proxy:
            return TracingHTTPClient(proxy=proxy, timeout=timeout)
        return TracingHTTPClient(timeout=timeout)

    def set_trace_context(self, trace_context: Optional[TraceContext]):
        """设置当前请求的 Trace 上下文"""
        _trace_context_var.set(trace_context)

    def clear_trace_context(self):
        """清除 Trace 上下文"""
        _trace_context_var.set(None)
        _current_request_trace.set({})

    def update_settings(self, temperature: float, max_tokens: int):
        """更新配置参数"""
        self.default_temperature = temperature
        self.max_tokens = max_tokens


# ============================================================================
# 单例实例
# ============================================================================

trace_service = TraceService()