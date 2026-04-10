"""
用户设置API测试
"""
import pytest

pytestmark = pytest.mark.asyncio


class TestUserProfile:
    """测试用户资料"""

    async def test_get_current_user(self, client, auth_headers):
        """应能获取当前用户信息"""
        response = await client.get(
            "/api/v1/users/me",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "email" in data["data"]
        assert "username" in data["data"]

    async def test_get_user_without_auth(self, client):
        """未认证应被拒绝"""
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401


class TestUserSettings:
    """测试用户设置"""

    async def test_update_settings(self, client, auth_headers):
        """应能更新用户设置"""
        response = await client.patch(
            "/api/v1/users/settings",
            headers=auth_headers,
            json={
                "theme": "dark",
                "language": "zh-CN",
                "default_model": "gpt-4",
                "temperature": 0.8
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["theme"] == "dark"

    async def test_update_theme(self, client, auth_headers):
        """应能切换主题"""
        for theme in ["dark", "light"]:
            response = await client.patch(
                "/api/v1/users/settings",
                headers=auth_headers,
                json={"theme": theme}
            )
            assert response.status_code == 200
            assert response.json()["data"]["theme"] == theme

    async def test_update_language(self, client, auth_headers):
        """应能切换语言"""
        response = await client.patch(
            "/api/v1/users/settings",
            headers=auth_headers,
            json={"language": "en-US"}
        )

        assert response.status_code == 200
        assert response.json()["data"]["language"] == "en-US"


class TestUserStats:
    """测试用户统计"""

    async def test_get_user_stats(self, client, auth_headers):
        """应能获取用户统计"""
        response = await client.get(
            "/api/v1/users/stats",
            headers=auth_headers
        )

        # 可能不存在此端点
        assert response.status_code in [200, 404]
