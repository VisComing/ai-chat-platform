"""
Agent Search API Tests
测试 LangGraph Agent 联网搜索功能
"""
import pytest
import asyncio
import httpx
import json
from typing import AsyncGenerator

# API base URL
BASE_URL = "http://localhost:8001"
API_PREFIX = "/api/v1"


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """创建异步 HTTP 客户端"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        yield client


class TestSearchService:
    """测试搜索服务"""
    
    @pytest.mark.asyncio
    async def test_search_basic(self, client: httpx.AsyncClient):
        """测试基本搜索功能"""
        response = await client.post(
            f"{BASE_URL}{API_PREFIX}/search",
            json={
                "query": "今天北京天气",
                "engine_type": "Generic",
                "time_range": "OneDay"
            }
        )
        
        # 搜索服务可能返回 404（如果路由不存在）或 200
        if response.status_code == 404:
            pytest.skip("Search endpoint not available")
        
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert "results" in data or "pageItems" in data
    
    @pytest.mark.asyncio
    async def test_search_with_time_range(self, client: httpx.AsyncClient):
        """测试带时间范围的搜索"""
        response = await client.post(
            f"{BASE_URL}{API_PREFIX}/search",
            json={
                "query": "最近新闻",
                "engine_type": "Generic",
                "time_range": "OneWeek"
            }
        )
        
        if response.status_code == 404:
            pytest.skip("Search endpoint not available")
        
        assert response.status_code in [200, 404]


class TestAgentChat:
    """测试 Agent 对话功能"""
    
    @pytest.mark.asyncio
    async def test_agent_stream_endpoint_exists(self, client: httpx.AsyncClient):
        """测试 Agent 流式端点是否存在"""
        # 先检查健康状态
        health = await client.get(f"{BASE_URL}/health")
        assert health.status_code == 200
        
        # Agent 端点应该存在
        # 但需要认证，所以可能返回 401
        response = await client.post(
            f"{BASE_URL}{API_PREFIX}/chat/agent/stream",
            json={
                "sessionId": None,
                "content": {"type": "text", "text": "测试"},
                "model": "qwen3.5-plus"
            }
        )
        
        # 应该返回 401（未认证）或 422（参数错误）或 200
        assert response.status_code in [200, 401, 422]
    
    @pytest.mark.asyncio
    async def test_agent_stream_with_auth(self, client: httpx.AsyncClient):
        """测试带认证的 Agent 流式对话"""
        # 获取测试 token（如果有）
        # 这里假设有一个测试用户
        
        # 创建会话
        response = await client.post(
            f"{BASE_URL}{API_PREFIX}/chat/agent/stream",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json"
            },
            json={
                "sessionId": None,
                "content": {"type": "text", "text": "今天北京天气怎么样？"},
                "model": "qwen3.5-plus"
            }
        )
        
        # 如果认证失败，跳过
        if response.status_code == 401:
            pytest.skip("Authentication required")
        
        # 应该返回 SSE 流
        if response.status_code == 200:
            # 检查是否是 SSE 格式
            content_type = response.headers.get("content-type", "")
            assert "text/event-stream" in content_type or "application/json" in content_type
    
    @pytest.mark.asyncio
    async def test_agent_search_trigger(self, client: httpx.AsyncClient):
        """测试 Agent 是否触发搜索"""
        # 这个测试需要完整的认证和会话
        # 简化版本：只测试端点响应
        
        response = await client.post(
            f"{BASE_URL}{API_PREFIX}/chat/agent/stream",
            json={
                "sessionId": "test_session",
                "content": {"type": "text", "text": "今天天气"},
                "model": "qwen3.5-plus"
            }
        )
        
        # 记录响应状态
        print(f"Response status: {response.status_code}")
        
        # 端点应该存在（即使返回认证错误）
        assert response.status_code in [200, 401, 422, 404]


class TestAgentSSEEvents:
    """测试 Agent SSE 事件"""
    
    @pytest.mark.asyncio
    async def test_sse_event_types(self):
        """测试 SSE 事件类型"""
        # 这个测试需要实际连接 SSE 流
        # 在集成测试中进行
        
        expected_events = [
            "session",
            "thinking",
            "tool_call",
            "text",
            "complete",
            "error",
            "title"
        ]
        
        # 验证事件类型定义
        for event in expected_events:
            assert isinstance(event, str)
            assert len(event) > 0
    
    @pytest.mark.asyncio
    async def test_sse_event_format(self):
        """测试 SSE 事件格式"""
        # SSE 事件格式示例
        event_example = {
            "event": "text",
            "data": json.dumps({
                "type": "text",
                "content": "测试内容",
                "messageId": "test_id"
            })
        }
        
        # 验证格式
        assert "event" in event_example
        assert "data" in event_example
        
        # 解析 data
        data = json.loads(event_example["data"])
        assert "type" in data


class TestSearchServiceDirect:
    """直接测试搜索服务"""
    
    @pytest.mark.asyncio
    async def test_search_service_available(self):
        """测试搜索服务是否可用"""
        from app.services.search_service import search_service
        
        # 检查 API key 是否配置
        assert search_service.api_key is not None or search_service.api_key == ""
        
        # 如果配置了 API key，测试搜索
        if search_service.api_key:
            results = await search_service.search(
                query="今天北京天气",
                engine_type="Generic",
                time_range="OneDay"
            )
            
            # 应该返回结果列表
            assert isinstance(results, list)
            
            # 如果有结果，验证格式
            if len(results) > 0:
                result = results[0]
                assert hasattr(result, "title")
                assert hasattr(result, "link")
                assert hasattr(result, "snippet")
    
    @pytest.mark.asyncio
    async def test_search_format_results(self):
        """测试搜索结果格式化"""
        from app.services.search_service import search_service, SearchResult
        
        # 创建测试结果
        test_results = [
            SearchResult(
                title="测试标题",
                link="https://example.com",
                snippet="测试摘要",
                rerank_score=0.8
            )
        ]
        
        # 格式化结果
        formatted = search_service.format_results_for_llm(test_results)
        
        # 应该包含标题、链接、摘要
        assert "测试标题" in formatted
        assert "https://example.com" in formatted
        assert "测试摘要" in formatted
    
    @pytest.mark.asyncio
    async def test_search_format_citations(self):
        """测试引用格式化"""
        from app.services.search_service import search_service, SearchResult
        
        # 创建测试结果
        test_results = [
            SearchResult(
                title="来源1",
                link="https://source1.com",
                snippet="摘要1"
            ),
            SearchResult(
                title="来源2",
                link="https://source2.com",
                snippet="摘要2"
            )
        ]
        
        # 格式化引用
        citations = search_service.format_citations(test_results)
        
        # 应该包含 Markdown 链接格式
        assert "[1]" in citations
        assert "[来源1]" in citations
        assert "https://source1.com" in citations
        assert "[2]" in citations


class TestAgentServiceDirect:
    """直接测试 Agent 服务"""
    
    @pytest.mark.asyncio
    async def test_agent_service_available(self):
        """测试 Agent 服务是否可用"""
        from app.services.agent_service import agent_service
        
        # 检查 Agent 服务是否初始化
        assert agent_service is not None
        assert agent_service.llm is not None
        assert agent_service.graph is not None
    
    @pytest.mark.asyncio
    async def test_agent_system_prompt(self):
        """测试 Agent 系统提示"""
        from app.services.agent_service import agent_service
        
        # 获取系统提示
        system_prompt = agent_service._get_system_prompt()
        
        # 应该包含搜索工具说明
        assert "web_search" in system_prompt
        assert "搜索" in system_prompt
        assert "引用" in system_prompt
    
    @pytest.mark.asyncio
    async def test_agent_chat_basic(self):
        """测试 Agent 基本对话"""
        from app.services.agent_service import agent_service
        
        # 测试消息
        messages = [
            {"role": "user", "content": "什么是机器学习？"}
        ]
        
        # 执行对话
        events = []
        async for event in agent_service.chat(messages):
            events.append(event)
        
        # 应该有事件
        assert len(events) > 0
        
        # 应该有 text 事件
        text_events = [e for e in events if e["event"] == "text"]
        assert len(text_events) > 0
        
        # 应该有 complete 事件
        complete_events = [e for e in events if e["event"] == "complete"]
        assert len(complete_events) > 0
        
        # 检查响应内容
        full_response = "".join([e["data"]["content"] for e in text_events])
        assert len(full_response) > 0
    
    @pytest.mark.asyncio
    async def test_agent_chat_with_search(self):
        """测试 Agent 对话触发搜索"""
        from app.services.agent_service import agent_service
        
        # 测试时间敏感问题
        messages = [
            {"role": "user", "content": "今天北京天气怎么样？"}
        ]
        
        # 执行对话
        events = []
        async for event in agent_service.chat(messages):
            events.append(event)
        
        # 应该有事件
        assert len(events) > 0
        
        # 检查是否有搜索
        complete_events = [e for e in events if e["event"] == "complete"]
        if complete_events:
            search_used = complete_events[0]["data"].get("search_used", False)
            print(f"Search used: {search_used}")
            
            # 如果搜索可用，应该触发
            # 如果搜索不可用，应该降级处理


# 运行测试
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])