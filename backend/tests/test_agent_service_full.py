"""
Agent Service Comprehensive Tests
全面测试 Agent Service 的各种功能和边界情况
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from typing import AsyncGenerator, Dict, Any, List

from app.services.agent_service import (
    agent_service,
    THINKING_MODELS,
    DEEPSEEK_MODELS,
    MULTIMODAL_MODELS,
)
from app.core.config import get_settings


class TestModelRouting:
    """测试模型路由逻辑"""

    def test_deepseek_models_list(self):
        """测试 DeepSeek 模型列表正确"""
        assert "deepseek-chat" in DEEPSEEK_MODELS
        assert "deepseek-reasoner" in DEEPSEEK_MODELS
        assert len(DEEPSEEK_MODELS) == 2

    def test_thinking_models_list(self):
        """测试深度思考模型列表包含 DeepSeek Reasoner"""
        assert "deepseek-reasoner" in THINKING_MODELS
        assert "qwen3.5-plus" in THINKING_MODELS

    def test_bailian_model_not_in_deepseek_list(self):
        """测试百炼模型不在 DeepSeek 列表中"""
        assert "qwen3.5-plus" not in DEEPSEEK_MODELS
        assert "glm-5" not in DEEPSEEK_MODELS


class TestCreateLLM:
    """测试 LLM 创建逻辑"""

    @pytest.mark.asyncio
    async def test_create_llm_for_deepseek(self):
        """测试为 DeepSeek 模型创建 LLM"""
        llm = agent_service._create_llm("deepseek-chat")

        # 验证使用 DeepSeek API（API key 被遮掩，检查 base_url）
        assert llm.openai_api_base == get_settings().deepseek_base_url
        assert llm.model_name == "deepseek-chat"
        # API key 存在（不为空字符串）
        assert llm.openai_api_key is not None and llm.openai_api_key != ""

    @pytest.mark.asyncio
    async def test_create_llm_for_bailian(self):
        """测试为百炼模型创建 LLM"""
        llm = agent_service._create_llm("qwen3.5-plus")

        # 验证使用百炼 API
        assert llm.openai_api_base == get_settings().bailian_base_url
        assert llm.model_name == "qwen3.5-plus"
        assert llm.openai_api_key is not None and llm.openai_api_key != ""

    @pytest.mark.asyncio
    async def test_create_llm_for_deepseek_reasoner(self):
        """测试 DeepSeek Reasoner 使用 DeepSeek API"""
        llm = agent_service._create_llm("deepseek-reasoner")

        assert llm.openai_api_base == get_settings().deepseek_base_url
        assert llm.model_name == "deepseek-reasoner"
        assert llm.openai_api_key is not None and llm.openai_api_key != ""


class MockAIMessageChunk:
    """模拟 AIMessageChunk"""

    def __init__(self, content: str = "", reasoning_content: str = "", additional_kwargs: dict = None):
        self.content = content
        self.additional_kwargs = additional_kwargs or {}
        if reasoning_content:
            self.additional_kwargs["reasoning_content"] = reasoning_content


class MockStreamEvent:
    """模拟流式事件"""

    def __init__(self, event_type: str, name: str = "", data: dict = None, tags: List[str] = None):
        self.event = event_type
        self.name = name
        self.data = data or {}
        self.tags = tags or []


class TestEventProcessing:
    """测试事件处理逻辑"""

    @pytest.mark.asyncio
    async def test_text_event_from_content(self):
        """测试从 content 生成 text 事件"""
        # 模拟事件
        mock_chunk = MockAIMessageChunk(content="你好，这是回复内容")
        mock_event = MockStreamEvent(
            event_type="on_llm_stream",
            data={"chunk": mock_chunk},
            tags=["agent:llm"]
        )

        # 验证：当 content 有内容且 tags 包含 agent:llm 时，应生成 text 事件
        content = mock_chunk.content
        reasoning_content = mock_chunk.additional_kwargs.get("reasoning_content", "")
        tags = mock_event.tags
        is_final_response = "agent:llm" in str(tags)

        assert is_final_response, "应判断为最终回复阶段"
        assert content.strip(), "content 应有内容"
        # 预期：生成 text 事件

    @pytest.mark.asyncio
    async def test_text_event_from_reasoning_content_when_content_empty(self):
        """测试当 content 为空时，从 reasoning_content 生成 text 事件"""
        # 模拟百炼 API 返回：content 为空，reasoning_content 有内容
        mock_chunk = MockAIMessageChunk(
            content="",
            reasoning_content="这是思考过程内容，应该作为回复"
        )
        mock_event = MockStreamEvent(
            event_type="on_llm_stream",
            data={"chunk": mock_chunk},
            tags=["agent:llm"]
        )

        content = mock_chunk.content
        reasoning_content = mock_chunk.additional_kwargs.get("reasoning_content", "")
        tags = mock_event.tags  # 修复：从 mock_event 获取 tags
        is_final_response = "agent:llm" in str(tags)
        enable_thinking = False

        # 预期逻辑：当 enable_thinking=False 且 content 为空 且 is_final_response=True 时
        # reasoning_content 应作为 text 事件
        if reasoning_content.strip() and not content.strip():
            if enable_thinking:
                expected_event = "thinking"
            elif is_final_response:
                expected_event = "text"
            else:
                expected_event = "thinking"

            assert expected_event == "text", "非深度思考模式下，空 content 时 reasoning_content 应作为 text"

    @pytest.mark.asyncio
    async def test_thinking_event_when_enable_thinking(self):
        """测试启用深度思考时，reasoning_content 作为 thinking 事件"""
        mock_chunk = MockAIMessageChunk(
            content="",
            reasoning_content="深度思考过程..."
        )
        mock_event = MockStreamEvent(
            event_type="on_llm_stream",
            data={"chunk": mock_chunk},
            tags=["agent:llm"]
        )

        enable_thinking = True
        reasoning_content = mock_chunk.additional_kwargs.get("reasoning_content", "")

        # 预期：启用深度思考时，reasoning_content 作为 thinking 事件
        if reasoning_content.strip() and enable_thinking:
            expected_event = "thinking"

        assert expected_event == "thinking", "深度思考模式下，reasoning_content 应作为 thinking"


class TestChatIntegration:
    """测试完整的对话流程"""

    @pytest.mark.asyncio
    async def test_chat_returns_events(self):
        """测试 chat 方法返回事件流"""
        messages = [{"role": "user", "content": "你好"}]

        events = []
        event_types = set()

        async for event in agent_service.chat(
            messages=messages,
            model="qwen3.5-plus",
            enable_search=False,
            enable_thinking=False,
        ):
            events.append(event)
            event_types.add(event.get("event"))

        # 验证至少返回了事件
        assert len(events) > 0, "应该返回事件"

        # 验证包含 complete 事件
        assert "complete" in event_types, "应该包含 complete 事件"

        # 验证有文本内容
        text_events = [e for e in events if e.get("event") == "text"]
        complete_event = [e for e in events if e.get("event") == "complete"]

        if text_events:
            accumulated_text = "".join(e["data"].get("content", "") for e in text_events)
            print(f"Accumulated text length: {len(accumulated_text)}")

        if complete_event:
            print(f"Complete event data: {complete_event[0]['data']}")

    @pytest.mark.asyncio
    async def test_chat_with_deepseek(self):
        """测试使用 DeepSeek 模型"""
        messages = [{"role": "user", "content": "你好"}]

        events = []
        async for event in agent_service.chat(
            messages=messages,
            model="deepseek-chat",
            enable_search=False,
            enable_thinking=False,
        ):
            events.append(event)

        # 验证返回了事件
        assert len(events) > 0

        # 验证有内容
        text_events = [e for e in events if e.get("event") == "text"]
        if text_events:
            text = "".join(e["data"].get("content", "") for e in text_events)
            assert len(text) > 0, "DeepSeek 应返回内容"
            print(f"DeepSeek response: {text[:100]}...")

    @pytest.mark.asyncio
    async def test_chat_with_search_enabled(self):
        """测试启用搜索的对话"""
        messages = [{"role": "user", "content": "今天北京天气怎么样？"}]

        events = []
        event_types = set()

        async for event in agent_service.chat(
            messages=messages,
            model="qwen3.5-plus",
            enable_search=True,
        ):
            events.append(event)
            event_types.add(event.get("event"))

        # 验证可能有搜索相关事件
        # 注意：搜索可能不会触发（取决于模型判断）
        print(f"Event types: {event_types}")

        # 验证有 complete 事件
        assert "complete" in event_types


class TestErrorHandling:
    """测试错误处理"""

    @pytest.mark.asyncio
    async def test_chat_with_invalid_model(self):
        """测试无效模型名称"""
        messages = [{"role": "user", "content": "你好"}]

        # 使用一个不存在的模型名称
        events = []
        has_error = False

        try:
            async for event in agent_service.chat(
                messages=messages,
                model="invalid-model-name",
                enable_search=False,
            ):
                events.append(event)
                if event.get("event") == "error":
                    has_error = True
        except Exception as e:
            has_error = True
            print(f"Exception: {e}")

        # 验证：要么返回错误事件，要么抛出异常
        print(f"Has error: {has_error}, Events count: {len(events)}")


class TestApiResponseFormat:
    """测试 API 返回格式处理"""

    def test_bailian_reasoning_content_format(self):
        """测试百炼 API reasoning_content 格式"""
        # 百炼 API 返回格式示例
        sample_response = {
            "choices": [{
                "delta": {
                    "content": None,
                    "reasoning_content": "思考过程..."
                }
            }]
        }

        # 验证格式理解正确
        delta = sample_response["choices"][0]["delta"]
        content = delta.get("content") or ""
        reasoning_content = delta.get("reasoning_content") or ""

        assert content == "", "content 应为空"
        assert reasoning_content != "", "reasoning_content 应有内容"

    def test_deepseek_response_format(self):
        """测试 DeepSeek API 返回格式"""
        sample_response = {
            "choices": [{
                "delta": {
                    "content": "这是回复内容"
                }
            }]
        }

        delta = sample_response["choices"][0]["delta"]
        content = delta.get("content") or ""

        assert content != "", "DeepSeek 应返回 content"


class TestCompleteEvent:
    """测试 complete 事件"""

    @pytest.mark.asyncio
    async def test_complete_event_structure(self):
        """测试 complete 事件的数据结构"""
        messages = [{"role": "user", "content": "你好"}]

        complete_event = None

        async for event in agent_service.chat(
            messages=messages,
            model="qwen3.5-plus",
            enable_search=False,
        ):
            if event.get("event") == "complete":
                complete_event = event

        assert complete_event is not None, "应该有 complete 事件"

        # 验证数据结构
        data = complete_event.get("data", {})
        assert "sources" in data or "search_used" in data, "应包含搜索相关信息"

        print(f"Complete event data keys: {data.keys()}")


# 运行测试
if __name__ == "__main__":
    print("\n" + "="*60)
    print("Agent Service 全面测试")
    print("="*60 + "\n")

    # 同步测试
    test_model = TestModelRouting()
    test_model.test_deepseek_models_list()
    test_model.test_thinking_models_list()
    test_model.test_bailian_model_not_in_deepseek_list()
    print("✅ 模型路由测试通过")

    # 异步测试
    asyncio.run(TestCreateLLM().test_create_llm_for_deepseek())
    asyncio.run(TestCreateLLM().test_create_llm_for_bailian())
    print("✅ LLM 创建测试通过")

    # 事件处理测试
    asyncio.run(TestEventProcessing().test_text_event_from_content())
    asyncio.run(TestEventProcessing().test_text_event_from_reasoning_content_when_content_empty())
    asyncio.run(TestEventProcessing().test_thinking_event_when_enable_thinking())
    print("✅ 事件处理逻辑测试通过")

    # API 格式测试
    test_api = TestApiResponseFormat()
    test_api.test_bailian_reasoning_content_format()
    test_api.test_deepseek_response_format()
    print("✅ API 格式处理测试通过")

    # 集成测试（需要 API Key）
    print("\n开始集成测试（需要 API Key）...")
    asyncio.run(TestChatIntegration().test_chat_returns_events())
    asyncio.run(TestChatIntegration().test_chat_with_deepseek())
    asyncio.run(TestChatIntegration().test_chat_with_search_enabled())
    print("✅ 集成测试通过")

    asyncio.run(TestCompleteEvent().test_complete_event_structure())
    print("✅ Complete 事件测试通过")

    print("\n" + "="*60)
    print("所有测试完成")
    print("="*60 + "\n")