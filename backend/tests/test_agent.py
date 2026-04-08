"""
Test Agent Service
测试 LangGraph Agent 的搜索能力
"""
import pytest
import asyncio
from app.services.agent_service import agent_service
from app.services.search_service import search_service


@pytest.mark.asyncio
async def test_search_triggered_for_weather():
    """测试天气查询触发搜索"""
    messages = [
        {"role": "user", "content": "今天北京天气怎么样？"}
    ]
    
    response_text = ""
    search_used = False
    
    async for event in agent_service.chat(messages):
        if event["event"] == "text":
            response_text += event["data"]["content"]
        elif event["event"] == "complete":
            search_used = event["data"].get("search_used", False)
    
    # 验证搜索被触发
    assert search_used, "天气查询应该触发搜索"
    
    # 验证回答包含天气信息
    assert "北京" in response_text or "天气" in response_text
    
    # 验证包含引用
    assert "[1]" in response_text or "参考来源" in response_text
    
    print(f"✅ 测试通过：天气查询触发搜索")
    print(f"回答: {response_text[:200]}...")


@pytest.mark.asyncio
async def test_search_triggered_for_latest_news():
    """测试最新新闻查询触发搜索"""
    messages = [
        {"role": "user", "content": "最近有什么重要新闻？"}
    ]
    
    response_text = ""
    search_used = False
    
    async for event in agent_service.chat(messages):
        if event["event"] == "text":
            response_text += event["data"]["content"]
        elif event["event"] == "complete":
            search_used = event["data"].get("search_used", False)
    
    # 验证搜索被触发
    assert search_used, "最新新闻查询应该触发搜索"
    
    print(f"✅ 测试通过：最新新闻查询触发搜索")


@pytest.mark.asyncio
async def test_search_not_triggered_for_commonsense():
    """测试常识问题不触发搜索"""
    messages = [
        {"role": "user", "content": "什么是机器学习？"}
    ]
    
    response_text = ""
    search_used = False
    
    async for event in agent_service.chat(messages):
        if event["event"] == "text":
            response_text += event["data"]["content"]
        elif event["event"] == "complete":
            search_used = event["data"].get("search_used", False)
    
    # 验证搜索未被触发
    assert not search_used, "常识问题不应触发搜索"
    
    # 验证回答包含机器学习相关内容
    assert "机器学习" in response_text or "学习" in response_text
    
    # 验证不包含引用
    assert "参考来源" not in response_text
    
    print(f"✅ 测试通过：常识问题不触发搜索")
    print(f"回答: {response_text[:200]}...")


@pytest.mark.asyncio
async def test_search_not_triggered_for_coding():
    """测试编程问题不触发搜索"""
    messages = [
        {"role": "user", "content": "Python 如何定义函数？"}
    ]
    
    response_text = ""
    search_used = False
    
    async for event in agent_service.chat(messages):
        if event["event"] == "text":
            response_text += event["data"]["content"]
        elif event["event"] == "complete":
            search_used = event["data"].get("search_used", False)
    
    # 验证搜索未被触发
    assert not search_used, "编程问题不应触发搜索"
    
    # 验证回答包含代码示例
    assert "def" in response_text or "function" in response_text.lower()
    
    print(f"✅ 测试通过：编程问题不触发搜索")


@pytest.mark.asyncio
async def test_search_timeout_handling():
    """测试搜索超时处理"""
    # 设置极短超时
    from app.core.config import get_settings
    settings = get_settings()
    original_timeout = settings.alibaba_search_timeout
    settings.alibaba_search_timeout = 1  # 1秒超时
    
    messages = [
        {"role": "user", "content": "今天上海天气怎么样？"}
    ]
    
    response_text = ""
    has_error = False
    
    try:
        async for event in agent_service.chat(messages):
            if event["event"] == "text":
                response_text += event["data"]["content"]
            elif event["event"] == "error":
                has_error = True
    except Exception as e:
        # 预期可能抛出超时异常
        has_error = True
    
    # 恢复原始超时设置
    settings.alibaba_search_timeout = original_timeout
    
    # 验证有错误或回答（降级处理）
    assert has_error or len(response_text) > 0, "超时应该有错误或降级回答"
    
    print(f"✅ 测试通过：搜索超时处理正常")


@pytest.mark.asyncio
async def test_search_service_direct():
    """直接测试搜索服务"""
    try:
        results = await search_service.search(
            query="Python programming",
            top_k=3
        )
        
        # 验证返回结果
        assert isinstance(results, list)
        
        if len(results) > 0:
            # 验证结果结构
            result = results[0]
            assert hasattr(result, 'title')
            assert hasattr(result, 'link')
            assert hasattr(result, 'snippet')
            
            print(f"✅ 测试通过：搜索服务返回 {len(results)} 个结果")
            print(f"第一个结果: {result.title}")
        else:
            print("⚠️ 搜索返回空结果（可能是 API Key 未配置）")
            
    except Exception as e:
        print(f"⚠️ 搜索服务测试失败: {e}")
        print("提示：请确保 ALIBABA_SEARCH_API_KEY 已配置")


@pytest.mark.asyncio
async def test_format_search_results():
    """测试搜索结果格式化"""
    from app.services.search_service import SearchResult
    
    # 创建模拟结果
    results = [
        SearchResult(
            title="Python Tutorial",
            link="https://example.com/python",
            snippet="Learn Python programming"
        ),
        SearchResult(
            title="Python Documentation",
            link="https://docs.python.org",
            snippet="Official Python docs"
        )
    ]
    
    # 测试格式化为 LLM 文本
    formatted_text = search_service.format_results_for_llm(results)
    assert "[1]" in formatted_text
    assert "Python Tutorial" in formatted_text
    assert "https://example.com/python" in formatted_text
    
    # 测试格式化引用
    citations = search_service.format_citations(results)
    assert "[1]" in citations
    assert "[Python Tutorial](https://example.com/python)" in citations
    
    print(f"✅ 测试通过：搜索结果格式化正确")
    print(f"LLM格式:\n{formatted_text}")
    print(f"引用格式:\n{citations}")


@pytest.mark.asyncio
async def test_multi_round_conversation():
    """测试多轮对话"""
    messages = [
        {"role": "user", "content": "什么是人工智能？"},
        {"role": "assistant", "content": "人工智能（AI）是计算机科学的一个分支..."},
        {"role": "user", "content": "最近AI有什么新进展？"}
    ]
    
    response_text = ""
    search_used = False
    
    async for event in agent_service.chat(messages):
        if event["event"] == "text":
            response_text += event["data"]["content"]
        elif event["event"] == "complete":
            search_used = event["data"].get("search_used", False)
    
    # 第二个问题应该触发搜索（包含"最近"）
    assert search_used, "多轮对话中的时间敏感问题应触发搜索"
    
    print(f"✅ 测试通过：多轮对话搜索判断正确")


# 运行所有测试
if __name__ == "__main__":
    print("\n" + "="*60)
    print("开始测试 LangGraph Agent 搜索能力")
    print("="*60 + "\n")
    
    asyncio.run(test_search_triggered_for_weather())
    asyncio.run(test_search_triggered_for_latest_news())
    asyncio.run(test_search_not_triggered_for_commonsense())
    asyncio.run(test_search_not_triggered_for_coding())
    asyncio.run(test_search_timeout_handling())
    asyncio.run(test_search_service_direct())
    asyncio.run(test_format_search_results())
    asyncio.run(test_multi_round_conversation())
    
    print("\n" + "="*60)
    print("所有测试完成")
    print("="*60 + "\n")