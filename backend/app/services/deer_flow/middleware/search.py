"""
Search Middleware - 搜索执行中间件

执行迭代搜索并收集信息
"""
import logging
from typing import Optional, List, Dict, Any

from app.services.deer_flow.state import DeerFlowState
from app.services.deer_flow.middleware.base import ProgressMiddleware
from app.services.deer_flow.sub_agent import SubAgent
from app.services.search_service import search_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class SearchMiddleware(ProgressMiddleware):
    """
    搜索执行中间件

    执行迭代搜索：
    - 根据策略选择搜索参数
    - 收集搜索结果和引用
    """

    name = "search"
    description = "执行搜索并收集信息"

    async def process(self, state: DeerFlowState) -> DeerFlowState:
        """执行搜索（通过 SubAgent 完成）"""
        # 搜索逻辑已在 SubAgent 中实现
        # 此中间件主要用于进度报告和结果汇总
        return state

    async def execute_single_search(
        self,
        query: str,
        strategy: str = "广度扫描"
    ) -> List[Dict[str, Any]]:
        """执行单次搜索"""
        if strategy == "广度扫描":
            top_k = 10
            time_range = search_service.TIME_NO_LIMIT
        elif strategy == "深度挖掘":
            top_k = 5
            time_range = search_service.TIME_ONE_YEAR
        else:  # 边缘探索
            top_k = 7
            time_range = search_service.TIME_NO_LIMIT

        results = await search_service.search(
            query=query,
            top_k=top_k,
            time_range=time_range,
            contents={"rerankScore": True, "mainText": True}
        )

        return [r.to_dict() for r in results]