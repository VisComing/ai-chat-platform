"""
认证API测试
测试用户认证流程
"""
import pytest

pytestmark = pytest.mark.asyncio


class TestAuthRegister:
    """测试用户注册"""

    async def test_register_new_user(self, client):
        """应能注册新用户"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "username": "testuser",
                "password": "TestPassword123!"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["user"]["email"] == "test@example.com"
        assert "accessToken" in data["data"]
        assert "refreshToken" in data["data"]

    async def test_register_duplicate_email(self, client):
        """不应能用重复邮箱注册"""
        # 先注册一个用户
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "duplicate@example.com",
                "username": "user1",
                "password": "TestPassword123!"
            }
        )

        # 再用相同邮箱注册
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "duplicate@example.com",
                "username": "user2",
                "password": "TestPassword123!"
            }
        )

        assert response.status_code == 400

    async def test_register_invalid_email(self, client):
        """无效邮箱格式应被拒绝"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "invalid-email",
                "username": "testuser",
                "password": "TestPassword123!"
            }
        )

        assert response.status_code == 422

    async def test_register_weak_password(self, client):
        """弱密码应被拒绝"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "test2@example.com",
                "username": "testuser",
                "password": "weak"
            }
        )

        assert response.status_code == 422


class TestAuthLogin:
    """测试用户登录"""

    async def test_login_with_valid_credentials(self, client):
        """应能用正确凭证登录"""
        # 先注册
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "login@example.com",
                "username": "loginuser",
                "password": "TestPassword123!"
            }
        )

        # 再登录
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "login@example.com",
                "password": "TestPassword123!"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "accessToken" in data["data"]

    async def test_login_with_wrong_password(self, client):
        """错误密码应被拒绝"""
        # 先注册
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "wrongpass@example.com",
                "username": "wrongpassuser",
                "password": "TestPassword123!"
            }
        )

        # 用错误密码登录
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "wrongpass@example.com",
                "password": "WrongPassword123"
            }
        )

        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client):
        """不存在用户应返回401"""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "TestPassword123!"
            }
        )

        assert response.status_code == 401


class TestTokenRefresh:
    """测试Token刷新"""

    async def test_refresh_access_token(self, client):
        """应能刷新访问令牌"""
        # 注册获取refresh token
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "refresh@example.com",
                "username": "refreshuser",
                "password": "TestPassword123!"
            }
        )
        refresh_token = register_response.json()["data"]["refreshToken"]

        # 刷新token
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "accessToken" in data["data"]

    async def test_refresh_with_invalid_token(self, client):
        """无效refresh token应被拒绝"""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-token"}
        )

        assert response.status_code == 401


class TestAuthLogout:
    """测试用户登出"""

    async def test_logout(self, client, auth_headers):
        """应能登出"""
        response = await client.post(
            "/api/v1/auth/logout",
            headers=auth_headers
        )

        assert response.status_code == 200
