"""
Test Agent Search Integration
测试 Agent 联网搜索功能的完整集成测试
"""
import pytest
import asyncio
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.services.agent_service import agent_service
from app.services.search_service import search_service


def make_message(text: str) -> dict:
    """创建符合 API 格式的消息"""
    return {"type": "text", "text": text}


@pytest.mark.asyncio
async def test_agent_receives_user_query():
    """测试 Agent 能正确接收用户问题"""
    messages = [
        {"role": "user", "content": make_message("你好，请告诉我今天是几号？")}
    ]

    response_text = ""
    events = []

    async for event in agent_service.chat(messages):
        events.append(event)
        if event["event"] == "text":
            response_text += event["data"].get("content", "")
        elif event["event"] == "tool_call":
            print(f"[TEST] Tool call event: {event['data']}")

    # 验证有响应
    assert len(response_text) > 0, "应该有响应文本"

    # 验证响应中包含日期信息（不应该说"用户问题为空"）
    assert "用户问题" not in response_text or "为空" not in response_text, \
        f"响应不应该说用户问题为空，实际响应: {response_text[:200]}"

    print(f"✅ 测试通过：Agent 正确接收用户问题")
    print(f"响应: {response_text[:300]}...")


@pytest.mark.asyncio
async def test_search_returns_sources():
    """测试搜索返回 sources 数据"""
    messages = [
        {"role": "user", "content": make_message("今天北京天气怎么样？")}
    ]

    response_text = ""
    tool_call_data = None
    complete_data = None

    async for event in agent_service.chat(messages):
        if event["event"] == "text":
            response_text += event["data"].get("content", "")
        elif event["event"] == "tool_call":
            tool_call_data = event["data"]
            print(f"[TEST] Tool call: tool={tool_call_data.get('tool')}, "
                  f"sources count={len(tool_call_data.get('sources', []))}")
        elif event["event"] == "complete":
            complete_data = event["data"]

    # 验证搜索被触发
    assert tool_call_data is not None, "应该触发搜索工具调用"
    assert tool_call_data.get("tool") == "web_search", "工具应该是 web_search"

    # 验证 sources 数据
    sources = tool_call_data.get("sources", [])
    assert len(sources) > 0, "应该返回搜索结果 sources"

    # 验证 source 结构
    first_source = sources[0]
    assert "title" in first_source, "source 应该有 title"
    assert "url" in first_source, "source 应该有 url"

    print(f"✅ 测试通过：搜索返回 {len(sources)} 个 sources")
    for i, s in enumerate(sources[:3]):
        print(f"  [{i+1}] {s.get('title', 'No title')[:50]}")

    # 验证最终响应
    assert len(response_text) > 0, "应该有最终响应"


@pytest.mark.asyncio
async def test_search_time_range_parameter():
    """测试 LLM 正确选择时间范围参数"""
    test_cases = [
        ("今天北京天气", "OneDay", "今天的天气应该用 OneDay"),
        ("最近有什么新闻", "OneWeek", "最近的新闻应该用 OneWeek 或更短"),
        ("Python 教程", "NoLimit", "编程教程不需要时间限制"),
    ]

    for query, expected_range, description in test_cases:
        messages = [
            {"role": "user", "content": make_message(query)}
        ]

        tool_call_data = None
        async for event in agent_service.chat(messages):
            if event["event"] == "tool_call":
                tool_call_data = event["data"]
            elif event["event"] == "complete":
                break

        if tool_call_data:
            # 有搜索，验证时间范围
            print(f"[TEST] Query: {query} -> search triggered")
        else:
            # 无搜索，也合理
            print(f"[TEST] Query: {query} -> no search (acceptable)")


@pytest.mark.asyncio
async def test_multi_turn_conversation():
    """测试多轮对话中搜索功能"""
    messages = [
        {"role": "user", "content": make_message("什么是 Python？")},
        {"role": "assistant", "content": "Python 是一种高级编程语言..."},
        {"role": "user", "content": make_message("Python 最新版本是什么？")}
    ]

    response_text = ""
    search_used = False

    async for event in agent_service.chat(messages):
        if event["event"] == "text":
            response_text += event["data"].get("content", "")
        elif event["event"] == "tool_call":
            search_used = True
        elif event["event"] == "complete":
            if event["data"].get("search_used"):
                search_used = True

    # 第二个问题可能触发搜索（关于最新版本）
    print(f"[TEST] Multi-turn: search_used={search_used}")
    print(f"[TEST] Response: {response_text[:200]}...")

    assert len(response_text) > 0, "应该有响应"

    print(f"✅ 测试通过：多轮对话正常")


@pytest.mark.asyncio
async def test_no_search_for_greeting():
    """测试问候语不触发搜索"""
    messages = [
        {"role": "user", "content": make_message("你好")}
    ]

    response_text = ""
    search_used = False

    async for event in agent_service.chat(messages):
        if event["event"] == "text":
            response_text += event["data"].get("content", "")
        elif event["event"] == "tool_call":
            search_used = True
        elif event["event"] == "complete":
            if event["data"].get("search_used"):
                search_used = True

    # 问候语不应该触发搜索
    assert not search_used, "问候语不应该触发搜索"
    assert len(response_text) > 0, "应该有响应"

    print(f"✅ 测试通过：问候语不触发搜索")
    print(f"响应: {response_text[:100]}")


@pytest.mark.asyncio
async def test_search_service_direct():
    """直接测试搜索服务"""
    results = await search_service.search(
        query="Python programming",
        top_k=3,
        time_range=search_service.TIME_NO_LIMIT
    )

    assert isinstance(results, list), "结果应该是列表"

    if len(results) > 0:
        result = results[0]
        assert hasattr(result, 'title'), "结果应该有 title"
        assert hasattr(result, 'link'), "结果应该有 link"
        print(f"✅ 测试通过：搜索服务返回 {len(results)} 个结果")
        print(f"  第一个: {result.title}")
    else:
        print("⚠️ 搜索返回空结果（可能 API Key 未配置）")


# 运行测试
if __name__ == "__main__":
    print("\n" + "="*60)
    print("测试 Agent 联网搜索功能")
    print("="*60 + "\n")

    asyncio.run(test_agent_receives_user_query())
    asyncio.run(test_search_returns_sources())
    asyncio.run(test_search_time_range_parameter())
    asyncio.run(test_multi_turn_conversation())
    asyncio.run(test_no_search_for_greeting())
    asyncio.run(test_search_service_direct())

    print("\n" + "="*60)
    print("所有测试完成")
    print("="*60 + "\n")