"""
DeerFlow State - 状态定义

基于 LangGraph TypedDict 模式，定义 Agent 工作流状态
"""
from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime
from enum import Enum


class ExecutionMode(str, Enum):
    """执行模式"""
    PARALLEL = "parallel"       # 并行执行（默认）
    SEQUENTIAL = "sequential"   # 顺序执行
    MIXED = "mixed"             # 混合模式（高优先级并行，低优先级顺序）
    ULTRA = "ultra"             # 全并行 + 最大迭代深度


class Phase(str, Enum):
    """工作流阶段"""
    CLARIFY = "clarify"         # 范围澄清
    PLAN = "plan"               # 任务规划
    RESEARCH = "research"       # 研究执行
    SYNTHESIZE = "synthesize"   # 结果综合
    COMPLETED = "completed"     # 完成
    FAILED = "failed"           # 失败


class SubTaskStatus(str, Enum):
    """子任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SubTaskConfig(TypedDict, total=False):
    """子任务配置"""
    id: str                     # 子任务 ID
    topic: str                  # 主题
    description: str            # 描述
    keywords: List[str]         # 搜索关键词
    priority: int               # 优先级 (1-5, 1最高)
    search_strategy: str        # 搜索策略: "广度扫描" | "深度挖掘" | "边缘探索"
    max_iterations: int         # 最大迭代次数
    target_score: float         # 目标评估分数


class AgentResult(TypedDict, total=False):
    """子 Agent 执行结果"""
    sub_task_id: str            # 对应的子任务 ID
    topic: str                  # 主题
    status: SubTaskStatus       # 执行状态
    collected_info: List[Dict[str, Any]]  # 收集的信息
    citations: List[Dict[str, Any]]       # 引用来源
    total_iterations: int       # 总迭代次数
    final_score: float          # 最终评估分数
    duration_ms: int            # 执行时长（毫秒）
    error: Optional[str]        # 错误信息


class DeerFlowState(TypedDict, total=False):
    """
    DeerFlow 工作流状态

    整体状态结构，用于 LangGraph StateGraph 和检查点持久化
    """
    # === 基础信息 ===
    task_id: str                # 任务 ID
    user_id: str                # 用户 ID
    query: str                  # 用户原始问题
    model: str                  # 使用的模型
    execution_mode: ExecutionMode  # 执行模式

    # === 澄清阶段 ===
    needs_clarification: bool   # 是否需要澄清
    clarification_questions: List[str]  # 澄清问题列表
    clarified_requirements: str        # 用户澄清的需求

    # === 规划阶段 ===
    research_goal: str          # 研究目标
    sub_tasks: List[SubTaskConfig]  # 子任务列表
    expected_sections: List[str]    # 预期报告章节

    # === 研究阶段 ===
    sub_agent_results: List[AgentResult]  # 子 Agent 执行结果
    running_agents: Dict[str, bool]  # 正在运行的 Agent（用于并行追踪）

    # === 综合阶段 ===
    collected_info: List[Dict[str, Any]]  # 所有收集的信息（汇总）
    citations: List[Dict[str, Any]]        # 所有引用（去重后）
    report: str                # 最终报告
    report_url: str            # 报告 URL（可选）

    # === 元数据 ===
    phase: Phase               # 当前阶段
    started_at: datetime       # 开始时间
    updated_at: datetime       # 更新时间
    total_duration_ms: int     # 总时长

    # === 统计 ===
    total_searches: int        # 总搜索次数
    total_iterations: int      # 总迭代次数

    # === 错误处理 ===
    error: Optional[str]       # 错误信息
    retry_count: int           # 重试次数


def create_initial_state(
    task_id: str,
    user_id: str,
    query: str,
    model: str = "qwen3-max-2026-01-23",
    execution_mode: ExecutionMode = ExecutionMode.PARALLEL,
) -> DeerFlowState:
    """创建初始状态"""
    now = datetime.utcnow()
    return DeerFlowState(
        task_id=task_id,
        user_id=user_id,
        query=query,
        model=model,
        execution_mode=execution_mode,
        phase=Phase.CLARIFY,
        started_at=now,
        updated_at=now,
        sub_tasks=[],
        sub_agent_results=[],
        running_agents={},
        collected_info=[],
        citations=[],
        total_searches=0,
        total_iterations=0,
        retry_count=0,
    )


def update_phase(state: DeerFlowState, phase: Phase) -> DeerFlowState:
    """更新阶段"""
    state["phase"] = phase
    state["updated_at"] = datetime.utcnow()
    return state


def merge_agent_results(state: DeerFlowState) -> DeerFlowState:
    """合并所有子 Agent 的结果"""
    all_info = []
    all_citations = []
    seen_links = set()

    for result in state.get("sub_agent_results", []):
        # 合并收集的信息
        for info in result.get("collected_info", []):
            all_info.append(info)

        # 合并引用（去重）
        for citation in result.get("citations", []):
            link = citation.get("link", "")
            if link and link not in seen_links:
                seen_links.add(link)
                all_citations.append(citation)

    state["collected_info"] = all_info
    state["citations"] = all_citations[:20]  # 限制引用数量
    state["updated_at"] = datetime.utcnow()
    return state