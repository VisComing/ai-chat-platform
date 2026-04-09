"""
DeerFlow Middleware Base - 中间件基类

可插拔的能力模块，支持 pre/post 处理
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

from app.services.deer_flow.state import DeerFlowState


class Middleware(ABC):
    """
    中间件基类

    所有中间件必须继承此基类并实现 process 方法
    """

    name: str = "base"
    description: str = "Base middleware"

    @abstractmethod
    async def process(self, state: DeerFlowState) -> DeerFlowState:
        """
        处理状态

        Args:
            state: 当前状态

        Returns:
            处理后的状态
        """
        pass

    async def pre_process(self, state: DeerFlowState) -> DeerFlowState:
        """
        前置处理（可选实现）

        在主处理之前执行
        """
        return state

    async def post_process(self, state: DeerFlowState) -> DeerFlowState:
        """
        后置处理（可选实现）

        在主处理之后执行
        """
        return state

    async def run(self, state: DeerFlowState) -> DeerFlowState:
        """
        完整执行流程

        按顺序：pre_process -> process -> post_process
        """
        state = await self.pre_process(state)
        state = await self.process(state)
        state = await self.post_process(state)
        return state


class ProgressMiddleware(Middleware):
    """
    进度报告中间件基类

    提供进度回调功能
    """

    def __init__(self, progress_callback: Optional[callable] = None):
        self.progress_callback = progress_callback

    async def report_progress(
        self,
        event_type: str,
        data: Dict[str, Any]
    ) -> None:
        """报告进度事件"""
        if self.progress_callback:
            await self.progress_callback(event_type, data)