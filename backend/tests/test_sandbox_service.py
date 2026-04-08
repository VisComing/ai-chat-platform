"""
Tests for Sandbox Service
沙箱服务测试
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock

from app.services.sandbox_service import SandboxService, SandboxResult
from app.core.config import settings


class TestSandboxService:
    """沙箱服务测试"""

    @pytest.fixture
    def sandbox(self):
        """创建沙箱服务实例"""
        return SandboxService()

    @pytest.mark.asyncio
    async def test_execute_with_sandbox_disabled(self, sandbox):
        """测试沙箱禁用时的执行（模拟模式）"""
        # 临时禁用沙箱
        original_enabled = settings.sandbox_enabled
        settings.sandbox_enabled = False

        try:
            result = await sandbox.execute(
                code="print('hello')",
                input_files={},
                expected_outputs=[],
                timeout=10,
            )

            assert isinstance(result, SandboxResult)
            assert result.exit_code == 0
            assert "沙箱已禁用" in result.stdout or "Sandbox disabled" in result.stdout

        finally:
            settings.sandbox_enabled = original_enabled

    @pytest.mark.asyncio
    async def test_execute_simple_code(self, sandbox):
        """测试执行简单代码"""
        # 在模拟模式下测试
        original_enabled = settings.sandbox_enabled
        settings.sandbox_enabled = False

        try:
            result = await sandbox.execute(
                code="x = 1 + 1; print(x)",
                timeout=5,
            )

            assert result is not None

        finally:
            settings.sandbox_enabled = original_enabled


class TestSandboxResult:
    """沙箱执行结果测试"""

    def test_create_success_result(self):
        """测试创建成功结果"""
        result = SandboxResult(
            stdout="output",
            stderr="",
            exit_code=0,
            output_files={},
            execution_time=0.5,
        )

        assert result.exit_code == 0
        assert result.stdout == "output"
        assert result.execution_time == 0.5

    def test_create_error_result(self):
        """测试创建错误结果"""
        result = SandboxResult(
            stdout="",
            stderr="Error: something went wrong",
            exit_code=1,
            output_files={},
            execution_time=0.1,
        )

        assert result.exit_code == 1
        assert "Error" in result.stderr

    def test_create_timeout_result(self):
        """测试创建超时结果"""
        result = SandboxResult(
            stdout="",
            stderr="Execution timed out",
            exit_code=-1,
            output_files={},
            execution_time=60,
        )

        assert result.exit_code == -1
        assert "timed out" in result.stderr.lower()

    def test_result_with_output_files(self):
        """测试包含输出文件的结果"""
        result = SandboxResult(
            stdout="",
            stderr="",
            exit_code=0,
            output_files={
                "chart.png": "/path/to/chart.png",
                "data.json": "/path/to/data.json",
            },
            execution_time=1.0,
        )

        assert len(result.output_files) == 2
        assert "chart.png" in result.output_files


class TestSandboxConfig:
    """沙箱配置测试"""

    def test_sandbox_config_values(self):
        """测试沙箱配置值"""
        assert settings.sandbox_container_image == "python:3.12-slim"
        assert settings.sandbox_cpu_limit == 1
        assert settings.sandbox_memory_limit == "512m"
        assert settings.sandbox_timeout == 60
        assert settings.sandbox_pool_size == 3