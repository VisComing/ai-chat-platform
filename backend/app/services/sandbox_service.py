"""
Sandbox Service - Docker Container Execution
沙箱服务 - 安全执行 Python 代码
"""
import asyncio
import io
import logging
import tarfile
from pathlib import Path
from typing import Dict, Any, Optional

from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class SandboxResult(BaseModel):
    """沙箱执行结果"""
    stdout: str
    stderr: str
    exit_code: int
    output_files: Dict[str, str]  # filename -> file path
    execution_time: float


class SandboxService:
    """
    沙箱服务 - 使用 Docker 容器安全执行代码

    注意：此服务需要 Docker 环境支持。
    在开发阶段可以设置 sandbox_enabled=False 来禁用沙箱。
    """

    def __init__(self):
        self.client = None
        self.pool = None
        self._initialized = False

    async def _ensure_initialized(self):
        """确保 Docker 客户端已初始化"""
        if self._initialized:
            return

        if not settings.sandbox_enabled:
            logger.info("[Sandbox] Sandbox is disabled, code execution will be simulated")
            self._initialized = True
            return

        try:
            import docker
            self.client = docker.from_env()
            self.pool = asyncio.Queue(maxsize=settings.sandbox_pool_size)
            await self._init_pool()
            self._initialized = True
            logger.info("[Sandbox] Docker client initialized successfully")
        except Exception as e:
            logger.warning(f"[Sandbox] Failed to initialize Docker client: {e}")
            logger.warning("[Sandbox] Sandbox will run in simulation mode")
            self._initialized = True

    async def _init_pool(self):
        """预创建容器池"""
        if not self.client:
            return

        for i in range(settings.sandbox_pool_size):
            try:
                container = await self._create_container()
                await self.pool.put(container)
                logger.debug(f"[Sandbox] Created container {i + 1}/{settings.sandbox_pool_size}")
            except Exception as e:
                logger.error(f"[Sandbox] Failed to create container: {e}")

    async def _create_container(self):
        """创建隔离容器"""
        loop = asyncio.get_event_loop()

        def _create():
            return self.client.containers.run(
                image=settings.sandbox_container_image,
                command="sleep infinity",
                detach=True,
                remove=False,
                # 资源限制
                cpu_quota=100000 * settings.sandbox_cpu_limit,
                mem_limit=settings.sandbox_memory_limit,
                # 安全隔离
                security_opt=["no-new-privileges"],
                cap_drop=["ALL"],
                # 网络：无网络访问
                network_mode="none",
                # 文件系统
                volumes={},
                # 工作目录
                working_dir="/workspace",
            )

        return await loop.run_in_executor(None, _create)

    async def execute(
        self,
        code: str,
        input_files: Optional[Dict[str, bytes]] = None,
        expected_outputs: Optional[list] = None,
        timeout: Optional[int] = None,
    ) -> SandboxResult:
        """
        执行 Python 代码

        Args:
            code: Python 代码字符串
            input_files: 输入文件 {filename: content}
            expected_outputs: 期望生成的输出文件名列表
            timeout: 执行超时时间（秒）

        Returns:
            SandboxResult: 执行结果
        """
        await self._ensure_initialized()

        timeout = timeout or settings.sandbox_timeout
        input_files = input_files or {}
        expected_outputs = expected_outputs or []

        # 如果沙箱被禁用，模拟执行
        if not settings.sandbox_enabled or not self.client:
            return await self._simulate_execution(code, input_files, expected_outputs)

        # 从池中获取容器
        container = await self.pool.get()

        try:
            import time
            start_time = time.time()

            # 写入输入文件
            if input_files:
                await self._write_files(container, input_files)

            # 执行代码
            exec_result = await self._exec_code(container, code, timeout)

            # 读取输出文件
            output_files = {}
            if expected_outputs:
                output_files = await self._read_files(container, expected_outputs)

            execution_time = time.time() - start_time

            return SandboxResult(
                stdout=exec_result.get("stdout", ""),
                stderr=exec_result.get("stderr", ""),
                exit_code=exec_result.get("exit_code", -1),
                output_files=output_files,
                execution_time=execution_time,
            )

        except asyncio.TimeoutError:
            logger.warning(f"[Sandbox] Code execution timed out after {timeout}s")
            return SandboxResult(
                stdout="",
                stderr=f"Execution timed out after {timeout} seconds",
                exit_code=-1,
                output_files={},
                execution_time=timeout,
            )

        except Exception as e:
            logger.error(f"[Sandbox] Execution failed: {e}")
            return SandboxResult(
                stdout="",
                stderr=str(e),
                exit_code=-1,
                output_files={},
                execution_time=0,
            )

        finally:
            # 清理工作目录并归还容器
            try:
                await self._cleanup_container(container)
            except Exception as e:
                logger.warning(f"[Sandbox] Failed to cleanup container: {e}")
                # 容器可能已损坏，创建新的替代
                try:
                    container.stop()
                    container.remove()
                    new_container = await self._create_container()
                    await self.pool.put(new_container)
                except:
                    pass
            else:
                await self.pool.put(container)

    async def _write_files(self, container, files: Dict[str, bytes]):
        """写入文件到容器"""
        loop = asyncio.get_event_loop()

        def _write():
            # 创建 tar 归档
            tar_stream = io.BytesIO()
            with tarfile.open(fileobj=tar_stream, mode='w') as tar:
                for filename, content in files.items():
                    data = content if isinstance(content, bytes) else content.encode()
                    tarinfo = tarfile.TarInfo(name=filename)
                    tarinfo.size = len(data)
                    tar.addfile(tarinfo, io.BytesIO(data))

            tar_stream.seek(0)
            container.put_archive("/workspace", tar_stream.read())

        await loop.run_in_executor(None, _write)

    async def _exec_code(self, container, code: str, timeout: int) -> Dict[str, Any]:
        """在容器中执行代码"""
        loop = asyncio.get_event_loop()

        def _exec():
            exec_result = container.exec_run(
                cmd=["python", "-c", code],
                workdir="/workspace",
                timeout=timeout,
            )
            output = exec_result.output.decode() if exec_result.output else ""
            return {
                "stdout": output if exec_result.exit_code == 0 else "",
                "stderr": output if exec_result.exit_code != 0 else "",
                "exit_code": exec_result.exit_code,
            }

        try:
            return await asyncio.wait_for(
                loop.run_in_executor(None, _exec),
                timeout=timeout + 5,  # 额外 5 秒缓冲
            )
        except asyncio.TimeoutError:
            raise

    async def _read_files(self, container, filenames: list) -> Dict[str, str]:
        """从容器读取输出文件"""
        loop = asyncio.get_event_loop()
        output_files = {}

        def _read():
            results = {}
            for filename in filenames:
                try:
                    bits, stat = container.get_archive(f"/workspace/{filename}")
                    # 解析 tar 归档
                    tar_stream = io.BytesIO()
                    for chunk in bits:
                        tar_stream.write(chunk)
                    tar_stream.seek(0)

                    with tarfile.open(fileobj=tar_stream, mode='r') as tar:
                        for member in tar.getmembers():
                            if member.isfile():
                                f = tar.extractfile(member)
                                if f:
                                    results[filename] = f.read()
                except Exception as e:
                    logger.warning(f"[Sandbox] Failed to read file {filename}: {e}")
            return results

        result = await loop.run_in_executor(None, _read)
        # 转换 bytes 为 str（假设文本文件）
        for filename, content in result.items():
            if isinstance(content, bytes):
                try:
                    output_files[filename] = content.decode('utf-8')
                except:
                    output_files[filename] = content.hex()
        return output_files

    async def _cleanup_container(self, container):
        """清理容器工作目录"""
        loop = asyncio.get_event_loop()

        def _cleanup():
            container.exec_run("rm -rf /workspace/*")

        await loop.run_in_executor(None, _cleanup)

    async def _simulate_execution(
        self,
        code: str,
        input_files: Dict[str, bytes],
        expected_outputs: list,
    ) -> SandboxResult:
        """
        模拟执行（当沙箱禁用时）

        这只是模拟，不会实际执行代码。
        """
        import time

        logger.info("[Sandbox] Running in simulation mode")
        start_time = time.time()

        # 模拟执行
        await asyncio.sleep(0.1)

        return SandboxResult(
            stdout="# 沙箱已禁用，代码未实际执行\n# Sandbox disabled, code not executed",
            stderr="",
            exit_code=0,
            output_files={},
            execution_time=time.time() - start_time,
        )

    async def cleanup(self):
        """清理所有容器"""
        if not self.client or not self.pool:
            return

        logger.info("[Sandbox] Cleaning up container pool...")

        while not self.pool.empty():
            try:
                container = self.pool.get_nowait()
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, container.stop)
                await loop.run_in_executor(None, container.remove)
            except Exception as e:
                logger.warning(f"[Sandbox] Failed to cleanup container: {e}")

        logger.info("[Sandbox] Container pool cleaned up")


# 单例实例
sandbox_service = SandboxService()