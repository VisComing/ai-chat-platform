"""
Unified Agent Service
统一的 AI 服务，整合对话、搜索、深度思考、多模态等能力
"""
import httpx
import json
import logging
import os
import base64
from typing import AsyncGenerator, Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from typing import TypedDict, Annotated

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
]

# 支持多模态的模型（图片输入）
MULTIMODAL_MODELS = [
    'qwen3.5-plus',
    'kimi-k2.5',
]


# ============================================================================
# 工具定义
# ============================================================================

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

        formatted = search_service.format_results_for_llm(results)
        return formatted

    except Exception as e:
        logger.error(f"Search tool error: {e}")
        return f"搜索失败: {str(e)}"


# ============================================================================
# Agent 状态定义
# ============================================================================

class AgentState(TypedDict):
    """Agent 状态定义"""
    messages: Annotated[List[Any], add_messages]
    search_results: Optional[List[Dict[str, str]]]
    search_query: Optional[str]
    iteration: int
    should_continue: bool


# ============================================================================
# 搜索结果模型
# ============================================================================

class SearchEvent(BaseModel):
    """搜索事件数据"""
    query: str
    results: List[Dict[str, Any]]
    iteration: int


# ============================================================================
# 图片处理工具函数
# ============================================================================

def load_image_as_base64(file_path: str) -> Optional[str]:
    """
    加载图片并转换为 base64 data URI
    """
    upload_dir = get_settings().upload_dir

    possible_paths = [
        file_path,
        os.path.join(upload_dir, file_path.lstrip('/')),
        os.path.join(upload_dir, 'images', file_path.split('/')[-1] if '/' in file_path else file_path),
    ]

    # 搜索用户子目录
    for root, dirs, files in os.walk(upload_dir):
        for file in files:
            if file.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                full_path = os.path.join(root, file)
                possible_paths.append(full_path)

    for path in possible_paths:
        if os.path.exists(path) and os.path.isfile(path):
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
    """统一的 Agent 服务"""

    def __init__(self):
        self.settings = get_settings()
        self.tools = [web_search]

    def is_thinking_model(self, model: str) -> bool:
        """判断模型是否支持深度思考"""
        model_lower = model.lower()
        return any(m in model_lower for m in THINKING_MODELS)

    def is_multimodal_model(self, model: str) -> bool:
        """判断模型是否支持多模态"""
        model_lower = model.lower()
        return any(m in model_lower for m in MULTIMODAL_MODELS)

    def _get_http_client(self) -> httpx.AsyncClient:
        """获取配置了代理的 httpx 客户端"""
        proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
        https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")

        if proxy or https_proxy:
            return httpx.AsyncClient(proxy=https_proxy or proxy, timeout=120.0)
        return httpx.AsyncClient(timeout=120.0)

    def _get_system_prompt(self, has_search_results: bool = False) -> str:
        """获取系统提示"""
        base_prompt = "你是一个智能助手，能够帮助用户解答问题。"
        if has_search_results:
            base_prompt += "\n\n你已经获取了相关的搜索结果，请基于这些信息回答用户的问题。"
        return base_prompt

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        enable_search: bool = True,
        enable_thinking: bool = False,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        统一对话入口

        Args:
            messages: 对话历史
            model: 模型名称
            enable_search: 是否启用联网搜索（用户手动控制）
            enable_thinking: 是否启用深度思考（用户手动控制）

        Yields:
            SSE 事件字典，包含 event 和 data
        """
        model = model or self.settings.default_model

        try:
            # 转换消息格式
            converted_messages = self._convert_messages(messages, model)

            # 记录迭代次数
            iteration = 0
            all_search_results = []

            # 如果启用搜索，执行 Agent 循环
            if enable_search:
                # 创建带工具的 LLM
                llm = self._create_llm(model)
                llm_with_tools = llm.bind_tools(self.tools)

                # Agent 循环
                current_messages = converted_messages.copy()

                while iteration < self.settings.agent_max_iterations:
                    iteration += 1
                    logger.info(f"[Agent] Iteration {iteration}")

                    # 调用 LLM（带工具）
                    system_prompt = self._get_system_prompt(has_search_results=len(all_search_results) > 0)
                    full_messages = [{"role": "system", "content": system_prompt}] + current_messages

                    # 使用非流式调用获取响应（判断是否需要工具）
                    response = await llm_with_tools.ainvoke(full_messages)

                    # 检查是否有工具调用
                    if hasattr(response, 'tool_calls') and response.tool_calls:
                        # 发送 thinking 事件（如果有）
                        if hasattr(response, 'content') and response.content:
                            thinking_text = response.content
                            if thinking_text and thinking_text.strip():
                                yield {
                                    "event": "thinking",
                                    "data": {
                                        "type": "thinking",
                                        "content": thinking_text,
                                        "iteration": iteration,
                                    }
                                }

                        # 处理每个工具调用
                        for tool_call in response.tool_calls:
                            if tool_call['name'] == 'web_search':
                                query = tool_call['args'].get('query', '')
                                time_range = tool_call['args'].get('time_range', 'NoLimit')

                                # 发送 tool_call 事件
                                yield {
                                    "event": "tool_call",
                                    "data": {
                                        "type": "tool_call",
                                        "tool": "web_search",
                                        "toolName": "web_search",
                                        "query": query,
                                        "toolArgs": {"query": query, "time_range": time_range},
                                        "iteration": iteration,
                                    }
                                }

                                # 执行搜索
                                search_results = await self._execute_search(query, time_range)
                                all_search_results.extend(search_results)

                                # 发送 search_result 事件
                                sources = self._format_sources(search_results)
                                yield {
                                    "event": "search_result",
                                    "data": {
                                        "type": "search_result",
                                        "query": query,
                                        "sources": sources,
                                        "iteration": iteration,
                                    }
                                }

                                # 将搜索结果加入消息
                                result_text = search_service.format_results_for_llm(
                                    [SearchResult(**r) for r in search_results]
                                )
                                current_messages.append({
                                    "role": "assistant",
                                    "content": f"搜索结果：{result_text}"
                                })
                                current_messages.append({
                                    "role": "user",
                                    "content": "请基于以上搜索结果回答问题。"
                                })
                    else:
                        # 没有工具调用，准备生成最终响应
                        break

                # 最终响应：流式生成
                # 标记这是最终轮次（iteration = "final"）
                final_iteration_label = "final"
                system_prompt = self._get_system_prompt(has_search_results=len(all_search_results) > 0)
                final_messages = [{"role": "system", "content": system_prompt}] + current_messages

                async for event in self._stream_chat_http(
                    messages=final_messages,
                    model=model,
                    enable_thinking=enable_thinking,
                    iteration_label=final_iteration_label,
                ):
                    yield event

            else:
                # 不启用搜索，直接流式对话
                system_prompt = self._get_system_prompt()
                final_messages = [{"role": "system", "content": system_prompt}] + converted_messages

                async for event in self._stream_chat_http(
                    messages=final_messages,
                    model=model,
                    enable_thinking=enable_thinking,
                    iteration_label=None,
                ):
                    yield event

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

        except Exception as e:
            logger.error(f"[Agent] Error: {e}")
            yield {
                "event": "error",
                "data": {
                    "type": "error",
                    "content": str(e),
                }
            }

    async def _stream_chat_http(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        enable_thinking: bool,
        iteration_label: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        HTTP 流式调用百炼 API

        直接获取 reasoning_content 和 content

        Args:
            messages: 消息列表
            model: 模型名称
            enable_thinking: 是否启用深度思考
            iteration_label: 迭代标识（如 "final" 或 None）
        """
        headers = {
            "Authorization": f"Bearer {self.settings.bailian_api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": self.settings.max_tokens,
            "temperature": self.settings.default_temperature,
            "stream": True,
            # 显式设置 enable_thinking 参数控制深度思考
            # true: 模型在思考后回复（返回 reasoning_content）
            # false: 模型直接回复（不思考）
            "enable_thinking": enable_thinking and self.is_thinking_model(model),
        }

        async with self._get_http_client() as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self.settings.bailian_base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        yield {
                            "event": "error",
                            "data": {
                                "type": "error",
                                "content": f"API Error: {response.status_code}",
                            }
                        }
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]

                            if data_str == "[DONE]":
                                break

                            try:
                                data = json.loads(data_str)
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})

                                    # 处理 reasoning_content（深度思考）- 只有启用时才发送
                                    reasoning_content = delta.get("reasoning_content", "")
                                    if reasoning_content and enable_thinking:
                                        yield {
                                            "event": "thinking",
                                            "data": {
                                                "type": "thinking",
                                                "content": reasoning_content,
                                                "iteration": iteration_label,
                                            }
                                        }

                                    # 处理 content（正常输出）
                                    content = delta.get("content", "")
                                    if content:
                                        yield {
                                            "event": "text",
                                            "data": {
                                                "type": "text",
                                                "content": content,
                                            }
                                        }

                            except json.JSONDecodeError:
                                continue

            except Exception as e:
                logger.error(f"[Stream HTTP] Error: {e}")
                yield {
                    "event": "error",
                    "data": {
                        "type": "error",
                        "content": str(e),
                    }
                }

    def _convert_messages(
        self,
        messages: List[Dict[str, Any]],
        model: str
    ) -> List[Dict[str, Any]]:
        """转换消息格式，处理多模态"""
        converted = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if isinstance(content, dict):
                converted_content = convert_multimodal_content(content, model)
            else:
                converted_content = content

            converted.append({
                "role": role,
                "content": converted_content,
            })

        return converted

    def _create_llm(self, model: str) -> ChatOpenAI:
        """创建 LLM 实例"""
        proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
        https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")

        http_client = None
        if proxy or https_proxy:
            http_client = httpx.AsyncClient(
                proxy=https_proxy or proxy,
                timeout=60.0
            )
            logger.info(f"[Agent] Using proxy: {https_proxy or proxy}")

        return ChatOpenAI(
            model=model,
            openai_api_key=self.settings.bailian_api_key,
            openai_api_base=self.settings.bailian_base_url,
            temperature=self.settings.default_temperature,
            max_tokens=self.settings.max_tokens,
            http_async_client=http_client,
        )

    async def _execute_search(
        self,
        query: str,
        time_range: str
    ) -> List[Dict[str, Any]]:
        """执行搜索并返回结果"""
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

        return [r.to_dict() for r in results]

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

        async with self._get_http_client() as client:
            response = await client.post(
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

        return "新对话"


# ============================================================================
# 单例实例
# ============================================================================

agent_service = AgentService()