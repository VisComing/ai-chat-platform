"""
DeerFlow Middleware Chain - 中间件链

按顺序执行中间件，管理工作流
"""
import logging
from typing import List, Optional, Callable

from app.services.deer_flow.state import DeerFlowState
from app.services.deer_flow.middleware.base import Middleware

logger = logging.getLogger(__name__)


class MiddlewareChain:
    """
    中间件链

    按顺序执行一系列中间件：
    - 每个中间件处理状态并传递给下一个
    - 支持进度回调
    """

    def __init__(
        self,
        middlewares: List[Middleware],
        progress_callback: Optional[Callable] = None,
    ):
        self.middlewares = middlewares
        self.progress_callback = progress_callback

    async def run(self, state: DeerFlowState) -> DeerFlowState:
        """
        执行中间件链

        Args:
            state: 初始状态

        Returns:
            处理后的最终状态
        """
        for middleware in self.middlewares:
            logger.debug(f"[MiddlewareChain] Running: {middleware.name}")
            state = await middleware.run(state)

            # 检查是否需要暂停（如澄清等待）
            if state.get("needs_clarification"):
                logger.info("[MiddlewareChain] Paused for clarification")
                break

        return state

    async def run_from_phase(
        self,
        state: DeerFlowState,
        start_phase: str
    ) -> DeerFlowState:
        """
        从指定阶段开始执行

        用于断点续跑场景
        """
        phase_to_middleware = {
            "clarify": 0,
            "plan": 1,
            "research": 2,
            "synthesize": 3,
        }

        start_index = phase_to_middleware.get(start_phase, 0)

        for middleware in self.middlewares[start_index:]:
            logger.debug(f"[MiddlewareChain] Running from {start_phase}: {middleware.name}")
            state = await middleware.run(state)

            if state.get("needs_clarification"):
                break

        return state


def create_default_chain(
    progress_callback: Optional[Callable] = None
) -> MiddlewareChain:
    """
    创建默认的中间件链

    包含：澄清 → 规划 → 搜索 → 评估 → 综合
    """
    from app.services.deer_flow.middleware import (
        ClarifyMiddleware,
        PlanMiddleware,
        SearchMiddleware,
        EvaluateMiddleware,
        SynthesizeMiddleware,
    )

    middlewares = [
        ClarifyMiddleware(progress_callback),
        PlanMiddleware(progress_callback),
        SearchMiddleware(progress_callback),
        EvaluateMiddleware(progress_callback),
        SynthesizeMiddleware(progress_callback),
    ]

    return MiddlewareChain(middlewares, progress_callback)