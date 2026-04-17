"""
DeerFlow - SuperAgent Harness for Deep Research

基于 DeerFlow 2.0 架构设计：
- 主 Agent + 动态子 Agent 架构
- 并行执行子任务
"""

from .state import DeerFlowState, SubTaskConfig, AgentResult, SearchStrategy
from .sub_agent import SubAgent
from .orchestrator import AgentOrchestrator

__all__ = [
    "DeerFlowState",
    "SubTaskConfig",
    "AgentResult",
    "SearchStrategy",
    "SubAgent",
    "AgentOrchestrator",
]