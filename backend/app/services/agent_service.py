"""
LangGraph Agent Service with Search Tool
实现智能搜索 Agent，支持自动判断是否需要联网搜索
"""
import json
import logging
import os
from typing import AsyncGenerator, Dict, Any, List, Optional, TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
import httpx
from pydantic import BaseModel
from app.core.config import get_settings
from app.services.search_service import search_service, SearchResult

logger = logging.getLogger(__name__)


# 定义 Agent 状态
class AgentState(TypedDict):
    """Agent 状态定义"""
    messages: Annotated[List[BaseMessage], add_messages]  # 对话历史，自动追加
    search_results: Optional[List[Dict[str, str]]]  # 搜索结果
    should_search: Optional[bool]  # 是否需要搜索
    final_response: Optional[str]  # 最终回复
    citations: Optional[List[Dict[str, str]]]  # 引用列表
    llm_with_tools: Optional[Any]  # 动态 LLM 实例


# 定义搜索工具
@tool
async def web_search(query: str, time_range: str = "NoLimit") -> str:
    """
    搜索互联网获取最新信息

    使用场景：
    - 需要最新新闻、事件、动态
    - 需要实时数据（天气、股价、汇率等）
    - 需要最新技术、产品信息
    - 用户询问时间敏感问题

    Args:
        query: 搜索关键词
        time_range: 时间范围，可选值：
            - "OneDay": 过去一天内（适用于"今天"、"现在"、"实时"等）
            - "OneWeek": 过去一周内（适用于"最近"、"本周"、"最新新闻"等）
            - "OneMonth": 过去一个月内（适用于"近一个月"、"近期"等）
            - "OneYear": 过去一年内（适用于"今年"、"近一年"等）
            - "NoLimit": 不限时间（适用于历史事实、通用知识等）
            默认为 "NoLimit"

    Returns:
        搜索结果文本（包含发布时间信息）
    """
    try:
        # 将 time_range 转换为搜索服务支持的格式
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

        # 格式化结果，包含时间信息
        formatted = search_service.format_results_for_llm(results)

        return formatted

    except Exception as e:
        logger.error(f"Search tool error: {e}")
        return f"搜索失败: {str(e)}"


class AgentService:
    """LangGraph Agent 服务"""

    def __init__(self):
        self.settings = get_settings()
        self.llm = self._create_llm()
        self.tools = [web_search]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        self.graph = self._build_graph()

    def _create_llm(self) -> ChatOpenAI:
        """创建 LLM 实例，配置代理支持"""
        # 创建 httpx 客户端，继承系统代理设置
        proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
        https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")

        http_client = None
        if proxy or https_proxy:
            # 使用代理配置 httpx 客户端
            http_client = httpx.AsyncClient(
                proxy=https_proxy or proxy,
                timeout=60.0
            )
            logger.info(f"[Agent] Using proxy: {https_proxy or proxy}")

        return ChatOpenAI(
            model=self.settings.default_model,
            openai_api_key=self.settings.bailian_api_key,
            openai_api_base=self.settings.bailian_base_url,
            temperature=self.settings.default_temperature,
            max_tokens=self.settings.max_tokens,
            http_async_client=http_client,
        )
    
    def _build_graph(self) -> StateGraph:
        """构建 LangGraph 状态图"""
        
        # 定义节点函数
        async def agent_node(state: AgentState) -> Dict[str, Any]:
            """Agent 节点：LLM 决策"""
            messages = state["messages"]
            llm_with_tools = state.get("llm_with_tools") or self.llm_with_tools
            
            # 添加系统提示
            system_prompt = self._get_system_prompt()
            full_messages = [SystemMessage(content=system_prompt)] + messages
            
            # 调用 LLM
            logger.info("[Agent Node] Invoking LLM with tools...")
            response = await llm_with_tools.ainvoke(full_messages)
            
            # 检查是否有工具调用
            if hasattr(response, "tool_calls") and response.tool_calls:
                logger.info(f"[Agent Node] Tool calls detected: {response.tool_calls}")
            else:
                logger.info("[Agent Node] No tool calls, returning final response")
            
            return {"messages": [response]}
        
        async def tools_node(state: AgentState) -> Dict[str, Any]:
            """工具节点：执行搜索"""
            messages = state["messages"]
            last_message = messages[-1]

            logger.info(f"[Tools Node] Checking last message for tool calls...")

            # 执行工具调用
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                tool_call = last_message.tool_calls[0]
                logger.info(f"[Tools Node] Executing tool: {tool_call['name']} with args: {tool_call['args']}")

                if tool_call["name"] == "web_search":
                    query = tool_call["args"]["query"]
                    # 从 LLM 传入的参数获取时间范围
                    time_range_arg = tool_call["args"].get("time_range", "NoLimit")

                    # 将 time_range 转换为搜索服务支持的格式
                    time_range_map = {
                        "OneDay": search_service.TIME_ONE_DAY,
                        "OneWeek": search_service.TIME_ONE_WEEK,
                        "OneMonth": search_service.TIME_ONE_MONTH,
                        "OneYear": search_service.TIME_ONE_YEAR,
                        "NoLimit": search_service.TIME_NO_LIMIT,
                    }
                    actual_time_range = time_range_map.get(time_range_arg, search_service.TIME_NO_LIMIT)
                    logger.info(f"[Tools Node] LLM selected time_range: {time_range_arg} -> {actual_time_range}")

                    try:
                        logger.info(f"[Tools Node] Searching for: {query} with timeRange: {actual_time_range}")
                        results = await search_service.search(
                            query=query,
                            top_k=5,
                            time_range=actual_time_range
                        )
                        logger.info(f"[Tools Node] Search returned {len(results)} results")
                        
                        # 保存搜索结果
                        search_results = [r.to_dict() for r in results]
                        
                        # 格式化结果
                        result_text = search_service.format_results_for_llm(results)
                        
                        # 创建工具响应消息
                        tool_message = {
                            "role": "tool",
                            "content": result_text,
                            "tool_call_id": tool_call["id"]
                        }
                        
                        return {
                            "messages": [AIMessage(content=result_text)],
                            "search_results": search_results
                        }
                        
                    except Exception as e:
                        logger.error(f"[Tools Node] Search failed: {e}")
                        error_msg = f"搜索失败: {str(e)}"
                        return {
                            "messages": [AIMessage(content=error_msg)],
                            "search_results": []
                        }
            else:
                logger.info("[Tools Node] No tool calls found in last message")
            
            return {}
        
        def should_continue(state: AgentState) -> str:
            """条件边：判断是否需要继续"""
            messages = state["messages"]
            last_message = messages[-1]
            
            # 如果最后一条消息有工具调用，继续到工具节点
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                return "tools"
            
            # 否则结束
            return END
        
        # 构建状态图
        workflow = StateGraph(AgentState)
        
        # 添加节点
        workflow.add_node("agent", agent_node)
        workflow.add_node("tools", tools_node)
        
        # 设置入口
        workflow.set_entry_point("agent")
        
        # 添加边
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "tools",
                END: END
            }
        )
        workflow.add_edge("tools", "agent")
        
        return workflow.compile()
    
    def _get_system_prompt(self) -> str:
        """获取系统提示"""
        return """你是一个智能助手，具备联网搜索能力。

## 回答格式要求

### 如果使用了搜索：
1. **整合信息**：将搜索结果整合成连贯的回答
2. **添加引用**：在回答中用角标标注来源，例如：
   ```
   北京今天晴天，气温 15-25°C[1]。
   ```
3. **文末列出引用**：
   ```
   ---
   **参考来源：**
   [1] [标题](链接)
   [2] [标题](链接)
   ```
"""
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        enable_thinking: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        执行 Agent 对话，支持流式输出

        Args:
            messages: 对话历史
            model: 模型名称（可选）
            enable_thinking: 是否启用深度思考模式

        Yields:
            事件字典，包含类型和数据
        """
        try:
            # 如果指定了模型，创建新的 LLM 实例
            if model and model != self.settings.default_model:
                # 创建 httpx 客户端，继承系统代理设置
                proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
                https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
                http_client = None
                if proxy or https_proxy:
                    http_client = httpx.AsyncClient(
                        proxy=https_proxy or proxy,
                        timeout=60.0
                    )

                llm = ChatOpenAI(
                    model=model,
                    openai_api_key=self.settings.bailian_api_key,
                    openai_api_base=self.settings.bailian_base_url,
                    temperature=self.settings.default_temperature,
                    max_tokens=self.settings.max_tokens,
                    http_async_client=http_client,
                )
                llm_with_tools = llm.bind_tools(self.tools)
            else:
                llm_with_tools = self.llm_with_tools
            
            # 转换消息格式
            langchain_messages = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")

                # Handle dict content format (e.g., {"type": "text", "text": "..."})
                if isinstance(content, dict):
                    content = content.get("text", str(content))

                if role == "user":
                    langchain_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    langchain_messages.append(AIMessage(content=content))
            
            # 初始化状态
            initial_state = {
                "messages": langchain_messages,
                "search_results": None,
                "should_search": None,
                "final_response": None,
                "citations": None,
                "llm_with_tools": llm_with_tools,
            }
            
            # 使用 astream 流式执行图
            search_results = []
            # 提取用户消息内容（处理字典格式）
            raw_content = messages[-1].get("content", "") if messages else ""
            if isinstance(raw_content, dict):
                search_query = raw_content.get("text", str(raw_content))
            else:
                search_query = str(raw_content)
            final_response_text = ""
            
            logger.info(f"[Chat] Starting graph execution with query: {search_query}")

            async for event in self.graph.astream(initial_state):
                logger.info(f"[Chat] Graph event: {event.keys()}")
                for node_name, node_output in event.items():
                    logger.info(f"[Chat] Node: {node_name}, output keys: {node_output.keys() if isinstance(node_output, dict) else 'not dict'}")
                    
                    if node_name == "tools":
                        # 检查是否有搜索结果
                        if "search_results" in node_output and node_output["search_results"]:
                            search_results = node_output["search_results"]

                            # 构建来源数据
                            sources = []
                            for r in search_results:
                                sources.append({
                                    "id": r.get("id", ""),
                                    "title": r.get("title", ""),
                                    "url": r.get("link", ""),
                                    "snippet": r.get("snippet", ""),
                                    "publishedTime": r.get("published_time"),
                                    "rerankScore": r.get("rerank_score"),
                                })

                            # 发送 tool_call 事件，包含搜索结果
                            yield {
                                "event": "tool_call",
                                "data": {
                                    "type": "tool_call",
                                    "tool": "web_search",
                                    "toolName": "web_search",
                                    "toolArgs": {"query": search_query},
                                    "resultCount": len(search_results),
                                    "sources": sources
                                }
                            }
                    
                    elif node_name == "agent":
                        # 检查是否是最终响应（没有 tool_calls）
                        if "messages" in node_output:
                            last_msg = node_output["messages"][-1]
                            if hasattr(last_msg, "content") and last_msg.content:
                                # 检查是否有 tool_calls
                                if not (hasattr(last_msg, "tool_calls") and last_msg.tool_calls):
                                    # 这是最终响应
                                    final_response_text = last_msg.content
            
            # 如果没有获取到最终响应，使用 ainvoke 重新执行
            if not final_response_text:
                logger.info("[Chat] No final response from astream, using ainvoke")
                final_state = await self.graph.ainvoke(initial_state)
                final_message = final_state.get("messages", [])[-1] if final_state else None
                if final_message:
                    final_response_text = final_message.content if hasattr(final_message, "content") else str(final_message)

            response_text = final_response_text

            # 如果有搜索结果，添加引用
            if search_results:
                citations_text = "\n\n---\n**参考来源：**\n"
                for i, result in enumerate(search_results, 1):
                    title = result.get('title', 'No title')
                    link = result.get('link', '')
                    citations_text += f"[{i}] [{title}]({link})\n"
                response_text += citations_text

            # 如果启用深度思考模式，使用 ai_service 生成带 thinking 的回答
            if enable_thinking:
                from app.services.ai_service import ai_service

                # 构建上下文消息
                context_msg = ""
                if search_results:
                    context_msg = f"\n\n以下是搜索到的相关信息：\n{search_service.format_results_for_llm([SearchResult(**r) for r in search_results])}"

                thinking_prompt = f"""基于以下内容回答用户问题，请先展示你的思考过程，再给出最终回答。

用户问题：{search_query}
{context_msg}

原始回答参考：{response_text[:500] if response_text else '无'}

请用中文回答，先输出思考过程（用 <think></think> 标签包裹），再输出正式回答。"""

                # 使用 ai_service 的 thinking 模式
                async for chunk in ai_service.chat_completion_with_thinking(
                    messages=[{"role": "user", "content": thinking_prompt}],
                    model=model or self.settings.default_model
                ):
                    if chunk.type == "thinking":
                        yield {
                            "event": "thinking",
                            "data": {
                                "type": "thinking",
                                "content": chunk.content,
                            }
                        }
                    elif chunk.type == "text":
                        yield {
                            "event": "text",
                            "data": {
                                "type": "text",
                                "content": chunk.content,
                            }
                        }
                    elif chunk.type == "error":
                        # 如果 thinking 失败，回退到普通模式
                        logger.warning(f"[Chat] Thinking mode failed: {chunk.content}")
                        break
                else:
                    # thinking 模式成功完成
                    yield {
                        "event": "complete",
                        "data": {
                            "type": "complete",
                            "search_used": len(search_results) > 0,
                            "sources": [],
                            "citations": search_results
                        }
                    }
                    return

            # 普通模式：流式输出（模拟）
            # 由于 LangGraph 不直接支持流式输出，我们分块返回
            chunk_size = 50
            for i in range(0, len(response_text), chunk_size):
                chunk = response_text[i:i+chunk_size]
                yield {
                    "event": "text",
                    "data": {
                        "type": "text",
                        "content": chunk
                    }
                }
            
            # 发送完成事件
            # 将搜索结果转换为 sources 格式
            sources = []
            for result in search_results:
                sources.append({
                    "id": result.get("id", ""),
                    "title": result.get("title", "No title"),
                    "url": result.get("link", ""),
                    "snippet": result.get("snippet", ""),
                    "rerankScore": result.get("rerankScore"),
                })

            yield {
                "event": "complete",
                "data": {
                    "type": "complete",
                    "search_used": len(search_results) > 0,
                    "sources": sources,
                    "citations": search_results
                }
            }
            
        except Exception as e:
            logger.error(f"Agent error: {e}")
            yield {
                "event": "error",
                "data": {
                    "type": "error",
                    "content": str(e)
                }
            }
    
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        执行 Agent 对话，流式输出文本
        
        Args:
            messages: 对话历史
            model: 模型名称（可选）
        
        Yields:
            文本块
        """
        async for event in self.chat(messages, model):
            if event["event"] == "text":
                yield event["data"]["content"]


# 单例实例
agent_service = AgentService()