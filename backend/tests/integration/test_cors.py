"""
CORS配置测试 - 确保前后端能正常通信
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


class TestCORS:
    """测试CORS配置"""
    
    def test_cors_headers_on_preflight(self):
        """测试预检请求返回正确的CORS头"""
        response = client.options(
            "/api/v1/auth/register",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        
        # 预检请求应该返回200
        assert response.status_code == 200
        
        # 检查CORS头
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers
        assert "access-control-allow-headers" in response.headers
    
    def test_cors_allows_any_origin_in_dev(self):
        """测试开发环境允许任何来源"""
        origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3000",
            "http://example.com",
        ]
        
        for origin in origins:
            response = client.options(
                "/api/v1/auth/register",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                },
            )
            
            assert response.status_code == 200, f"Failed for origin: {origin}"
            # 在开发模式下应该允许所有来源
            allow_origin = response.headers.get("access-control-allow-origin", "")
            assert allow_origin == "*" or origin in allow_origin, \
                f"Origin {origin} not allowed: {allow_origin}"
    
    def test_cors_on_actual_request(self):
        """测试实际请求包含CORS头"""
        # Use unique email to avoid conflicts
        import time
        timestamp = int(time.time())
        
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"test-cors-{timestamp}@example.com",
                "username": f"testcors{timestamp}",
                "password": "TestPassword123!",
            },
            headers={"Origin": "http://localhost:3000"},
        )
        
        # 请求应该成功
        assert response.status_code == 200
        
        # 响应应该包含CORS头
        assert "access-control-allow-origin" in response.headers


class TestHealthCheck:
    """测试健康检查端点"""
    
    def test_health_endpoint_accessible(self):
        """测试健康检查端点可访问"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_root_endpoint_accessible(self):
        """测试根路径可访问"""
        response = client.get("/")
        assert response.status_code == 200


class TestAuthenticationFlow:
    """测试完整认证流程"""
    
    def test_register_login_flow(self):
        """测试注册和登录流程"""
        import time
        
        # 1. 注册
        timestamp = int(time.time())
        register_data = {
            "email": f"test-{timestamp}@example.com",
            "username": f"testuser-{timestamp}",
            "password": "TestPassword123!",
        }
        
        response = client.post("/api/v1/auth/register", json=register_data)
        assert response.status_code == 200, f"Register failed: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert "accessToken" in data["data"]
        token = data["data"]["accessToken"]
        
        # 2. 使用token访问受保护端点
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200, f"Get user failed: {response.text}"
        
        # 3. 登录
        response = client.post(
            "/api/v1/auth/login",
            json={
                "account": register_data["email"],
                "password": register_data["password"],
            },
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert "accessToken" in data["data"]
    
    def test_protected_endpoint_without_token(self):
        """测试未认证访问受保护端点"""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401
    
    def test_protected_endpoint_with_invalid_token(self):
        """测试无效token访问受保护端点"""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401