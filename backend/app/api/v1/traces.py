"""
Trace API - 模型调用追踪查询接口

提供 trace 数据的查询功能，支持关联对话查看。
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.security import get_current_user_id
from app.models.model_trace import ModelTrace
from app.schemas import ApiResponse

router = APIRouter()


@router.get("")
async def list_traces(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session_id: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
):
    """
    列表查询 trace

    支持按 session_id 和 model 筛选。
    """
    # 构建查询条件
    conditions = [ModelTrace.user_id == user_id]

    if session_id:
        conditions.append(ModelTrace.session_id == session_id)

    if model:
        conditions.append(ModelTrace.model == model)

    # 统计总数
    total = await ModelTrace.find(*conditions).count()

    # 分页查询
    traces = await ModelTrace.find(*conditions).sort("-created_at").skip((page - 1) * limit).limit(limit).to_list()

    return ApiResponse(
        success=True,
        data={
            "data": [_trace_to_dict(t) for t in traces],
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": (page * limit) < total,
        },
    )


@router.get("/session/{session_id}")
async def get_session_traces(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    获取某个会话的所有 trace

    用于关联对话查看，按时间排序展示调用时间线。
    """
    traces = await ModelTrace.find(
        ModelTrace.user_id == user_id,
        ModelTrace.session_id == session_id,
    ).sort("created_at").to_list()

    return ApiResponse(
        success=True,
        data=[_trace_to_dict(t) for t in traces],
    )


@router.get("/{trace_id}")
async def get_trace(
    trace_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    获取单条 trace 详情
    """
    trace = await ModelTrace.find_one(
        ModelTrace.id == trace_id,
        ModelTrace.user_id == user_id,
    )

    if not trace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trace 记录不存在",
        )

    return ApiResponse(
        success=True,
        data=_trace_to_dict_detail(trace),
    )


def _trace_to_dict(trace: ModelTrace) -> dict:
    """转换为简洁的字典格式（用于列表）"""
    return {
        "id": trace.id,
        "session_id": trace.session_id,
        "message_id": trace.message_id,
        "model": trace.model,
        "api_provider": trace.api_provider,
        "duration_ms": trace.duration_ms,
        "token_input": trace.token_input,
        "token_output": trace.token_output,
        "status": trace.status,
        "created_at": trace.created_at.isoformat() if trace.created_at else None,
    }


def _trace_to_dict_detail(trace: ModelTrace) -> dict:
    """转换为详细的字典格式（用于详情）"""
    return {
        "id": trace.id,
        "user_id": trace.user_id,
        "session_id": trace.session_id,
        "message_id": trace.message_id,
        "model": trace.model,
        "api_provider": trace.api_provider,
        "request_messages": trace.request_messages,
        "request_params": trace.request_params,
        "response_content": trace.response_content,
        "response_reasoning": trace.response_reasoning,
        "duration_ms": trace.duration_ms,
        "token_input": trace.token_input,
        "token_output": trace.token_output,
        "status": trace.status,
        "error_message": trace.error_message,
        "tool_calls": trace.tool_calls,
        "created_at": trace.created_at.isoformat() if trace.created_at else None,
    }