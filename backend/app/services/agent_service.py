"""
Unified Agent Service
使用 LangGraph create_react_agent 实现的 AI 服务
整合对话、搜索、深度思考、多模态等能力
"""
import httpx
import json
import logging
import os
import base64
from typing import AsyncGenerator, Dict, Any, List, Optional
from pydantic import BaseModel
from contextvars import ContextVar
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langgraph.pregel import Pregel

from app.core.config import get_settings
from app.services.search_service import search_service, SearchResult

logger = logging.getLogger(__name__)


# ============================================================================
# 配置常量
# ============================================================================

# 支持深度思考的模型（返回 reasoning_content）
THINKING_MODELS = [
    'qwen3.5-plus',
    'qwen3-max',
    'qwen3-max-2026-01-23',
    'glm-5',
    'glm-4.7',
    'kimi-k2.5',
    'MiniMax-M2.5',
    'deepseek-reasoner',
]

# DeepSeek 模型列表（需要使用 DeepSeek API）
DEEPSEEK_MODELS = ['deepseek-chat', 'deepseek-reasoner']

# 支持多模态的模型（图片输入）
MULTIMODAL_MODELS = [
    'qwen3.5-plus',
    'kimi-k2.5',
]


# ============================================================================
# 工具定义
# ============================================================================

# 使用 ContextVar 传递 request_id，解决并发安全问题
_request_id_var: ContextVar[str] = ContextVar("request_id")
# 搜索结果缓存：key = request_id + query（带 TTL 清理）
_search_results_cache: Dict[str, List[Dict[str, Any]]] = {}

@tool
async def web_search(query: str, time_range: str = "NoLimit") -> str:
    """
    搜索互联网获取信息

    使用场景：
    - 需要最新新闻、事件、动态、实时数据

    Args:
        query: 搜索关键词
        time_range: 时间范围，可选值：
            - "OneDay": 过去一天内
            - "OneWeek": 过去一周内
            - "OneMonth": 过去一个月内
            - "OneYear": 过去一年内
            - "NoLimit": 不限时间
            默认为 "NoLimit"

    Returns:
        搜索结果文本（包含发布时间信息）
    """
    try:
        time_range_map = {
            "OneDay": search_service.TIME_ONE_DAY,
            "OneWeek": search_service.TIME_ONE_WEEK,
            "OneMonth": search_service.TIME_ONE_MONTH,
            "OneYear": search_service.TIME_ONE_YEAR,
            "NoLimit": search_service.TIME_NO_LIMIT,
        }
        actual_time_range = time_range_map.get(time_range, search_service.TIME_NO_LIMIT)

        results = await search_service.search(
            query=query,
            top_k=5,
            time_range=actual_time_range
        )

        if not results:
            return "未找到相关搜索结果。"

        # 保存搜索结果用于 SSE 事件（使用 request_id 避免并发冲突）
        request_id = _request_id_var.get("")
        cache_key = f"{request_id}:{query}"
        _search_results_cache[cache_key] = [r.to_dict() for r in results]

        formatted = search_service.format_results_for_llm(results)
        return formatted

    except httpx.TimeoutException as e:
        logger.error(f"Search tool timeout: {e}")
        return "搜索超时，请稍后重试。"
    except Exception as e:
        logger.error(f"Search tool error: {e}", exc_info=True)
        return f"搜索失败: {str(e)}"


# ============================================================================
# 图片处理工具函数
# ============================================================================

def load_image_as_base64(file_path: str) -> Optional[str]:
    """
    加载图片并转换为 base64 data URI
    """
    upload_dir = get_settings().upload_dir

    # 安全路径：只检查直接路径和 images 子目录，避免全目录遍历
    possible_paths = [
        file_path,
        os.path.join(upload_dir, file_path.lstrip('/')),
        os.path.join(upload_dir, 'images', file_path.split('/')[-1] if '/' in file_path else file_path),
    ]

    for path in possible_paths:
        if os.path.exists(path) and os.path.isfile(path):
            # 安全检查：确保路径在 upload_dir 内
            try:
                real_path = os.path.realpath(path)
                real_upload_dir = os.path.realpath(upload_dir)
                if not real_path.startswith(real_upload_dir):
                    logger.warning(f"Path traversal attempt blocked: {file_path}")
                    continue
            except Exception:
                continue

            try:
                with open(path, 'rb') as f:
                    image_data = f.read()

                ext = os.path.splitext(path)[1].lower()
                mime_map = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                }
                mime_type = mime_map.get(ext, 'image/jpeg')

                b64_data = base64.b64encode(image_data).decode('utf-8')
                return f"data:{mime_type};base64,{b64_data}"
            except Exception as e:
                logger.error(f"Failed to load image {path}: {e}")
                continue

    return None


def convert_multimodal_content(
    content: Dict[str, Any],
    model: str
) -> str | List[Dict[str, Any]]:
    """
    转换多模态消息内容为模型特定格式
    """
    content_type = content.get("type", "text")

    if content_type == "text":
        return content.get("text", "")

    parts = content.get("parts", [content]) if content_type == "mixed" else [content]

    text_parts = [p for p in parts if p.get("type") == "text"]
    image_parts = [p for p in parts if p.get("type") == "image"]

    if not image_parts:
        return " ".join([p.get("text", "") for p in text_parts])

    # 检查模型是否支持多模态
    model_lower = model.lower()
    supports_multimodal = any(m in model_lower for m in MULTIMODAL_MODELS)

    if not supports_multimodal:
        text_content = " ".join([p.get("text", "") for p in text_parts])
        if image_parts:
            text_content += "\n[提示：当前模型不支持图片理解，已忽略图片内容]"
        return text_content

    # 转换为 OpenAI 多模态格式
    result = []
    for part in image_parts:
        url = part.get("url", "")
        if url:
            if url.startswith("data:") or url.startswith("http"):
                result.append({
                    "type": "image_url",
                    "image_url": {"url": url}
                })
            else:
                b64_uri = load_image_as_base64(url)
                if b64_uri:
                    result.append({
                        "type": "image_url",
                        "image_url": {"url": b64_uri}
                    })

    text_content = " ".join([p.get("text", "") for p in text_parts])
    if text_content:
        result.append({
            "type": "text",
            "text": text_content
        })

    return result


# ============================================================================
# 统一 Agent 服务
# ============================================================================

class AgentService:
    """使用 LangGraph create_react_agent 的统一 Agent 服务"""

    def __init__(self):
        self.settings = get_settings()
        self.tools = [web_search]
        # Memory saver 用于保持多轮对话状态
        self.memory = MemorySaver()
        # 缓存已创建的 agent（最多 16 个：8 模型 × 2 配置）
        self._agents: Dict[str, Pregel] = {}
        # 共享 HTTP 客户端
        self._http_client: Optional[httpx.AsyncClient] = None

    def is_thinking_model(self, model: str) -> bool:
        """判断模型是否支持深度思考"""
        model_lower = model.lower()
        return any(m in model_lower for m in THINKING_MODELS)

    def is_multimodal_model(self, model: str) -> bool:
        """判断模型是否支持多模态"""
        model_lower = model.lower()
        return any(m in model_lower for m in MULTIMODAL_MODELS)

    def _create_http_client(self) -> httpx.AsyncClient:
        """创建共享 HTTP 客户端"""
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("http_proxy")
        if proxy:
            return httpx.AsyncClient(proxy=proxy, timeout=120.0)
        return httpx.AsyncClient(timeout=120.0)

    def _get_http_client(self) -> httpx.AsyncClient:
        """获取 HTTP 客户端（延迟初始化）"""
        if self._http_client is None:
            self._http_client = self._create_http_client()
        return self._http_client

    def _get_system_prompt(self) -> str:
        """获取系统提示"""
        return "你是一个智能助手，能够帮助用户解答问题。"

    def _create_llm(self, model: str) -> ChatOpenAI:
        """创建 LLM 实例，根据模型选择对应的 API"""
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("http_proxy")

        http_client = None
        if proxy:
            http_client = httpx.AsyncClient(proxy=proxy, timeout=60.0)
            logger.info(f"[Agent] Using proxy: {proxy}")

        # 根据模型选择 API 配置
        if model in DEEPSEEK_MODELS:
            api_key = self.settings.deepseek_api_key
            base_url = self.settings.deepseek_base_url
            logger.info(f"[Agent] Using DeepSeek API for model: {model}")
        else:
            api_key = self.settings.bailian_api_key
            base_url = self.settings.bailian_base_url
            logger.info(f"[Agent] Using Bailian API for model: {model}")

        return ChatOpenAI(
            model=model,
            openai_api_key=api_key,
            openai_api_base=base_url,
            temperature=self.settings.default_temperature,
            max_tokens=self.settings.max_tokens,
            http_async_client=http_client,
        )

    def _get_agent(self, model: str, enable_search: bool = True) -> Pregel:
        """获取或创建指定模型的 agent"""
        cache_key = f"{model}:{enable_search}"

        if cache_key in self._agents:
            return self._agents[cache_key]

        llm = self._create_llm(model)
        tools = self.tools if enable_search else []
        agent = create_react_agent(
            llm,
            tools=tools,
            checkpointer=self.memory,
        )
        self._agents[cache_key] = agent
        logger.info(f"[Agent] Created agent: {model}, search={enable_search}")
        return agent

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        enable_search: bool = True,
        enable_thinking: bool = False,
        session_id: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        统一对话入口

        Args:
            messages: 对话历史
            model: 模型名称
            enable_search: 是否启用联网搜索（用户手动控制）
            enable_thinking: 是否启用深度思考（用户手动控制）
            session_id: 会话 ID，用于保持多轮对话状态

        Yields:
            SSE 事件字典，包含 event 和 data
        """
        model = model or self.settings.default_model
        session_id = session_id or "default"

        try:
            # 根据是否启用搜索选择不同的处理路径
            if enable_search:
                # 使用 Agent（带搜索工具）
                async for event in self._chat_with_agent(
                    messages=messages,
                    model=model,
                    enable_thinking=enable_thinking,
                    enable_search=enable_search,
                    session_id=session_id,
                ):
                    yield event
            else:
                # 直接调用 LLM（不带工具，避免空 tools 数组错误）
                async for event in self._chat_without_tools(
                    messages=messages,
                    model=model,
                    enable_thinking=enable_thinking,
                ):
                    yield event

        except Exception as e:
            logger.error(f"[Agent] Error: {e}", exc_info=True)
            yield {
                "event": "error",
                "data": {
                    "type": "error",
                    "content": str(e),
                }
            }

    async def _chat_without_tools(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        enable_thinking: bool,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        直接调用 LLM（不使用 Agent/工具）

        用于 enable_search=False 的情况，避免空 tools 数组导致的 API 错误。

        Args:
            messages: 对话历史
            model: 模型名称
            enable_thinking: 是否启用深度思考

        Yields:
            SSE 事件字典
        """
        import time

        llm = self._create_llm(model)
        lc_messages = self._convert_to_lc_messages(messages, model)

        start_time = time.time()
        accumulated_text = ""

        logger.info(f"[Agent] Direct LLM call for model: {model}")

        try:
            # 直接流式调用 LLM
            async for chunk in llm.astream(lc_messages):
                content = chunk.content or ""

                # 获取 reasoning_content（百炼扩展字段）
                reasoning_content = ""
                if hasattr(chunk, "additional_kwargs"):
                    reasoning_content = chunk.additional_kwargs.get("reasoning_content", "") or ""

                # 处理 reasoning_content
                if reasoning_content and reasoning_content.strip():
                    if enable_thinking:
                        # 深度思考模式：作为思考过程
                        yield {
                            "event": "thinking",
                            "data": {
                                "type": "thinking",
                                "content": reasoning_content,
                                "iteration": 1,
                            }
                        }
                    else:
                        # 非深度思考模式：作为最终回复（百炼返回的 reasoning_content 实际是回复内容）
                        accumulated_text += reasoning_content
                        yield {
                            "event": "text",
                            "data": {
                                "type": "text",
                                "content": reasoning_content,
                            }
                        }

                # 处理正常 content
                if content and content.strip():
                    accumulated_text += content
                    yield {
                        "event": "text",
                        "data": {
                            "type": "text",
                            "content": content,
                        }
                    }

            # 发送完成事件
            yield {
                "event": "complete",
                "data": {
                    "type": "complete",
                    "search_used": False,
                    "sources": [],
                    "citations": [],
                    "iterations": 0,
                    "duration": time.time() - start_time,
                }
            }

        except Exception as e:
            logger.error(f"[Agent] Direct LLM error: {e}", exc_info=True)
            yield {
                "event": "error",
                "data": {
                    "type": "error",
                    "content": str(e),
                }
            }

    async def _chat_with_agent(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        enable_thinking: bool,
        enable_search: bool,
        session_id: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        使用 LangGraph agent 处理对话

        使用 astream_events 获取细粒度的事件，直接流式输出

        Args:
            messages: 对话历史
            model: 模型名称
            enable_thinking: 是否启用深度思考
            enable_search: 是否启用搜索工具
            session_id: 会话 ID

        Yields:
            SSE 事件字典
        """
        import uuid

        agent = self._get_agent(model, enable_search=enable_search)

        # 生成唯一 request_id 用于搜索结果缓存隔离
        request_id = str(uuid.uuid4())
        _request_id_var.set(request_id)

        # 记录本次请求的所有缓存 key，用于 finally 清理
        request_cache_keys: List[str] = []

        # 转换消息格式为 LangChain Message 对象
        lc_messages = self._convert_to_lc_messages(messages, model)

        # 配置 thread_id 和 recursion_limit（防止无限循环）
        config = {
            "configurable": {"thread_id": session_id},
            "recursion_limit": self.settings.agent_max_iterations + 5,
        }

        # 记录迭代次数和搜索结果
        iteration = 0
        all_search_results: List[Dict[str, Any]] = []
        current_query = ""
        # 标记是否已经完成工具调用，进入最终回复阶段
        final_response_started = False

        try:
            # 使用 astream_events 获取细粒度事件
            async for event in agent.astream_events({"messages": lc_messages}, config, version="v2"):
                event_type = event.get("event", "")

                # on_chain_start: Agent 开始执行
                if event_type == "on_chain_start":
                    name = event.get("name", "")
                    if name == "agent":
                        iteration += 1
                        logger.info(f"[Agent] Iteration {iteration} starting, request_id={request_id}")

                # on_tool_start: 工具开始调用
                elif event_type == "on_tool_start":
                    tool_name = event.get("name", "")
                    if tool_name == "web_search":
                        tool_input = event.get("data", {}).get("input", {})
                        query = tool_input.get("query", "") if isinstance(tool_input, dict) else ""
                        current_query = query

                        # 发送 tool_call 事件
                        yield {
                            "event": "tool_call",
                            "data": {
                                "type": "tool_call",
                                "tool": "web_search",
                                "toolName": "web_search",
                                "query": query,
                                "toolArgs": tool_input,
                                "iteration": iteration,
                            }
                        }

                # on_tool_end: 工具调用结束
                elif event_type == "on_tool_end":
                    tool_name = event.get("name", "")
                    if tool_name == "web_search":
                        # 从缓存中获取搜索结果（使用 request_id 避免并发冲突）
                        cache_key = f"{request_id}:{current_query}"
                        request_cache_keys.append(cache_key)

                        if cache_key in _search_results_cache:
                            search_results = _search_results_cache[cache_key]
                            all_search_results.extend(search_results)

                            # 发送 search_result 事件
                            sources = self._format_sources(search_results)
                            yield {
                                "event": "search_result",
                                "data": {
                                    "type": "search_result",
                                    "query": current_query,
                                    "sources": sources,
                                    "iteration": iteration,
                                }
                            }

                # on_llm_stream: LLM 流式输出
                elif event_type == "on_llm_stream":
                    data = event.get("data", {})
                    chunk = data.get("chunk")

                    # chunk 是 AIMessageChunk 对象
                    if chunk:
                        # 获取内容
                        content = chunk.content or ""

                        # 尝试从 additional_kwargs 获取 reasoning_content（百炼扩展字段）
                        reasoning_content = ""
                        if hasattr(chunk, "additional_kwargs"):
                            reasoning_content = chunk.additional_kwargs.get("reasoning_content", "") or ""

                        # 通过 tags 区分是 agent 思考还是最终回复
                        tags = event.get("tags", [])

                        # 判断是否是最终回复阶段
                        is_final_response = "agent:llm" in str(tags) or final_response_started

                        # 处理 reasoning_content
                        # 情况1: 启用深度思考时，reasoning_content 是思考过程
                        # 情况2: 未启用深度思考且 content 为空时，reasoning_content 作为最终回复
                        if reasoning_content and reasoning_content.strip():
                            if enable_thinking:
                                # 深度思考模式：作为思考过程发送
                                yield {
                                    "event": "thinking",
                                    "data": {
                                        "type": "thinking",
                                        "content": reasoning_content,
                                        "iteration": iteration,
                                    }
                                }
                            elif is_final_response and not content.strip():
                                # 非深度思考模式且 content 为空：reasoning_content 作为最终回复
                                final_response_started = True
                                yield {
                                    "event": "text",
                                    "data": {
                                        "type": "text",
                                        "content": reasoning_content,
                                    }
                                }
                            else:
                                # 其他情况：作为思考过程发送
                                yield {
                                    "event": "thinking",
                                    "data": {
                                        "type": "thinking",
                                        "content": reasoning_content,
                                        "iteration": iteration,
                                    }
                                }

                        # 处理正常内容
                        if content and content.strip():
                            if is_final_response:
                                final_response_started = True
                                yield {
                                    "event": "text",
                                    "data": {
                                        "type": "text",
                                        "content": content,
                                    }
                                }
                            else:
                                yield {
                                    "event": "thinking",
                                    "data": {
                                        "type": "thinking",
                                        "content": content,
                                        "iteration": iteration,
                                    }
                                }

            # 发送完成事件
            yield {
                "event": "complete",
                "data": {
                    "type": "complete",
                    "search_used": len(all_search_results) > 0,
                    "sources": self._format_sources(all_search_results),
                    "citations": all_search_results,
                    "iterations": iteration,
                }
            }

        finally:
            # 确保清理本次请求的所有缓存
            for key in request_cache_keys:
                _search_results_cache.pop(key, None)
            logger.debug(f"[Agent] Cleaned {len(request_cache_keys)} cache keys for request {request_id}")

    def _convert_to_lc_messages(
        self,
        messages: List[Dict[str, Any]],
        model: str
    ) -> List[Any]:
        """
        将 API 消息格式转换为 LangChain Message 对象

        Args:
            messages: API 消息列表
            model: 模型名称

        Returns:
            LangChain Message 对象列表
        """
        lc_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # 处理多模态内容
            if isinstance(content, dict):
                converted_content = convert_multimodal_content(content, model)
            else:
                converted_content = content

            if role == "system":
                lc_messages.append(SystemMessage(content=converted_content))
            elif role == "assistant":
                lc_messages.append(AIMessage(content=converted_content))
            elif role == "user":
                lc_messages.append(HumanMessage(content=converted_content))
            # tool 角色的消息由 LangGraph 自动处理

        return lc_messages

    def _format_sources(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """格式化搜索结果为 sources 格式"""
        sources = []
        for r in results:
            sources.append({
                "id": r.get("id", ""),
                "title": r.get("title", ""),
                "url": r.get("link", ""),
                "snippet": r.get("snippet", ""),
                "publishedTime": r.get("published_time"),
                "rerankScore": r.get("rerank_score"),
            })
        return sources

    async def generate_title(
        self,
        user_message: str,
        ai_response: str = "",
    ) -> str:
        """
        生成对话标题

        Args:
            user_message: 用户消息
            ai_response: AI 响应

        Returns:
            生成的标题（10字以内）
        """
        ai_response_truncated = ai_response[:500] if len(ai_response) > 500 else ai_response
        input_content = f"用户: {user_message}\n助手: {ai_response_truncated}"

        system_prompt = "基于以下对话，生成一个10字以内的标题，只返回标题"

        headers = {
            "Authorization": f"Bearer {self.settings.bailian_api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.settings.title_generation_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": input_content},
            ],
            "max_tokens": 20,
            "temperature": 0.3,
            "stream": False,
        }

        try:
            # 使用共享 HTTP 客户端
            response = await self._get_http_client().post(
                f"{self.settings.bailian_base_url}/chat/completions",
                headers=headers,
                json=payload,
            )

            if response.status_code != 200:
                logger.error(f"[Title] API error: {response.status_code}")
                return "新对话"

            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                title = data["choices"][0].get("message", {}).get("content", "")
                title = title.strip().strip('"\'').strip()

                if len(title) < 2:
                    return "新对话"
                if len(title) > 10:
                    title = title[:10]

                return title

        except Exception as e:
            logger.error(f"[Title] Error: {e}", exc_info=True)

        return "新对话"


# ============================================================================
# 单例实例
# ============================================================================

agent_service = AgentService()