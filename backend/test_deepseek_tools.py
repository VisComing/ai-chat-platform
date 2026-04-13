"""
测试 DeepSeek Reasoner 的工具调用 - 对话历史版本
"""
import asyncio
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"


@tool
def web_search(query: str) -> str:
    """搜索互联网获取信息"""
    return f"搜索结果: {query} - 找到相关信息"


async def test_with_conversation_history():
    """测试带有对话历史的工具调用"""

    print("=" * 60)
    print("测试带有对话历史的 DeepSeek Reasoner 工具调用")
    print("=" * 60)

    # 创建 LLM
    llm = ChatOpenAI(
        model="deepseek-reasoner",
        openai_api_key=DEEPSEEK_API_KEY,
        openai_api_base=DEEPSEEK_BASE_URL,
        temperature=0.7,
    )

    # 创建带 memory 的 agent
    memory = MemorySaver()
    agent = create_react_agent(llm, tools=[web_search], checkpointer=memory)

    # 模拟对话历史（类似失败的请求）
    conversation_history = [
        HumanMessage(content="你好"),
        AIMessage(content="你好！很高兴见到你！我是一个AI助手，可以帮助你搜索互联网上的最新信息。"),
        HumanMessage(content="你好"),
        AIMessage(content="你好呀！很高兴再次见到你！我依然在这里，随时准备为你提供帮助。"),
        HumanMessage(content="查询一下黄金价格"),
        AIMessage(content="黄金价格是实时变动的，建议您通过权威渠道查询。"),
        HumanMessage(content="查询"),
        AIMessage(content="是要查询黄金价格还是其他信息？"),
        HumanMessage(content="对"),  # 这是最后一个用户输入
    ]

    # 使用同一个 thread_id（模拟多轮对话）
    thread_id = "test_session_001"
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 10}

    print(f"对话历史: {len(conversation_history)} 条消息")
    print(f"最后用户输入: '对'")
    print()

    # 使用 astream_events
    tool_called = False
    iteration_count = 0
    reasoning_parts = []
    content_parts = []

    async for event in agent.astream_events({"messages": conversation_history}, config, version="v2"):
        event_type = event.get("event", "")
        event_name = event.get("name", "")

        # 打印关键事件
        if event_type == "on_chain_start" and event_name == "agent":
            iteration_count += 1
            print(f"Iteration {iteration_count} starting...")

        if event_type == "on_tool_start":
            tool_called = True
            print(f"Tool start: {event_name}")
            print(f"  Input: {event.get('data', {}).get('input', {})}")

        elif event_type == "on_tool_end":
            print(f"Tool end: {event_name}")
            print(f"  Output: {event.get('data', {}).get('output', '')}")

        elif event_type == "on_chat_model_stream":
            chunk = event.get("data", {}).get("chunk")
            if chunk:
                if chunk.content:
                    content_parts.append(chunk.content)
                if hasattr(chunk, "additional_kwargs"):
                    rc = chunk.additional_kwargs.get("reasoning_content", "")
                    if rc:
                        reasoning_parts.append(rc)
                    # 检查 tool_call_chunks
                    tc_chunks = chunk.additional_kwargs.get("tool_call_chunks", chunk.tool_call_chunks if hasattr(chunk, 'tool_call_chunks') else None)
                    if tc_chunks:
                        print(f"  tool_call_chunks: {tc_chunks}")

    print()
    print("=" * 60)
    print("结果")
    print("=" * 60)
    print(f"迭代次数: {iteration_count}")
    print(f"工具被调用: {tool_called}")
    print(f"思考内容长度: {len(''.join(reasoning_parts))}")
    print(f"回复内容长度: {len(''.join(content_parts))}")

    if reasoning_parts:
        print()
        print("思考内容:")
        print(''.join(reasoning_parts)[:500])

    if content_parts:
        print()
        print("回复内容:")
        print(''.join(content_parts)[:300])


async def test_simple_query():
    """测试简单查询"""

    print()
    print("=" * 60)
    print("测试简单查询（无对话历史）")
    print("=" * 60)

    llm = ChatOpenAI(
        model="deepseek-reasoner",
        openai_api_key=DEEPSEEK_API_KEY,
        openai_api_base=DEEPSEEK_BASE_URL,
        temperature=0.7,
    )

    memory = MemorySaver()
    agent = create_react_agent(llm, tools=[web_search], checkpointer=memory)

    messages = [HumanMessage(content="查询黄金价格")]

    thread_id = "test_session_002"
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 10}

    tool_called = False
    reasoning_parts = []
    content_parts = []

    async for event in agent.astream_events({"messages": messages}, config, version="v2"):
        event_type = event.get("event", "")
        event_name = event.get("name", "")

        if event_type == "on_tool_start":
            tool_called = True
            print(f"Tool start: {event_name}")
            print(f"  Input: {event.get('data', {}).get('input', {})}")

        elif event_type == "on_tool_end":
            print(f"Tool end: {event_name}")

        elif event_type == "on_chat_model_stream":
            chunk = event.get("data", {}).get("chunk")
            if chunk:
                if chunk.content:
                    content_parts.append(chunk.content)
                if hasattr(chunk, "additional_kwargs"):
                    rc = chunk.additional_kwargs.get("reasoning_content", "")
                    if rc:
                        reasoning_parts.append(rc)

    print()
    print(f"工具被调用: {tool_called}")
    print(f"思考内容长度: {len(''.join(reasoning_parts))}")
    print(f"回复内容长度: {len(''.join(content_parts))}")


if __name__ == "__main__":
    asyncio.run(test_with_conversation_history())
    asyncio.run(test_simple_query())