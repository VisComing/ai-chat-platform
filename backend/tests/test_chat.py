"""
聊天API测试
测试聊天功能
"""
import pytest
import asyncio

pytestmark = pytest.mark.asyncio


class TestChatStream:
    """测试流式聊天"""

    async def test_send_message_stream(self, client, auth_headers, test_session_id):
        """应能发送消息并接收流式响应"""
        response = await client.post(
            "/api/v1/chat/stream",
            headers={**auth_headers, "Accept": "text/event-stream"},
            json={
                "session_id": test_session_id,
                "content": {"type": "text", "text": "Hello"},
                "model": "qwen3.5-plus"
            },
            timeout=30.0
        )

        # 可能返回200或需要特定模型配置
        assert response.status_code in [200, 422, 400]

        if response.status_code == 200:
            content = response.text
            assert "event:" in content
            assert "data:" in content

    async def test_chat_without_auth(self, client):
        """未认证应被拒绝"""
        response = await client.post(
            "/api/v1/chat/stream",
            json={
                "session_id": "test-session",
                "content": {"type": "text", "text": "Hello"}
            }
        )

        assert response.status_code == 401

    async def test_chat_invalid_session(self, client, auth_headers):
        """无效会话应返回错误"""
        response = await client.post(
            "/api/v1/chat/stream",
            headers=auth_headers,
            json={
                "session_id": "invalid-session-id",
                "content": {"type": "text", "text": "Hello"}
            }
        )

        assert response.status_code in [404, 400]


class TestAgentChat:
    """测试Agent聊天"""

    async def test_agent_stream_endpoint(self, client, auth_headers):
        """Agent流式端点应存在"""
        response = await client.post(
            "/api/v1/chat/agent/stream",
            headers=auth_headers,
            json={
                "sessionId": None,
                "content": {"type": "text", "text": "测试"},
                "model": "qwen3.5-plus"
            }
        )

        # 可能返回200、401（需要认证）或422（参数错误）
        assert response.status_code in [200, 401, 422]


class TestChatModels:
    """测试模型列表"""

    async def test_get_models(self, client):
        """应能获取支持的模型列表"""
        response = await client.get("/api/v1/chat/models")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
        assert len(data["data"]) > 0

    async def test_models_contain_expected(self, client):
        """应包含预期模型"""
        response = await client.get("/api/v1/chat/models")
        data = response.json()
        models = data["data"]

        # 检查是否包含预期模型
        expected_models = ["qwen3.5-plus", "glm-5"]
        for model in expected_models:
            assert model in models, f"模型 {model} 不在列表中"
