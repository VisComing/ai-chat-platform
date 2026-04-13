"""
Model Trace - 模型调用追踪记录

记录底层模型调用的请求和响应，用于追踪用户对话。
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import Field, field_validator
from beanie import Document, Indexed
from bson import ObjectId

from app.models.models import generate_uuid, objectid_to_str


class ModelTrace(Document):
    """
    模型调用追踪记录

    每一条记录代表一次完整的模型请求-响应调用。
    Agent 流程中可能触发多次 LLM 调用，每次产生一条 trace。
    """

    id: str = Field(default_factory=generate_uuid, alias="_id")

    # 关联用户对话
    user_id: Indexed(str)
    session_id: Indexed(str)
    message_id: Indexed(str)  # 对应的 assistant message

    # 模型信息
    model: str
    api_provider: str  # "bailian" 或 "deepseek"

    # 请求内容
    request_messages: List[Dict[str, Any]]  # 发送给模型的完整消息（包含 system prompt、历史消息）
    request_params: Optional[Dict[str, Any]] = None  # temperature, max_tokens, enable_thinking 等

    # 响应内容
    response_content: str = ""  # 模型返回的文本内容
    response_reasoning: Optional[str] = None  # 深度思考内容（reasoning_content）

    # 元数据
    duration_ms: int = 0  # 调用耗时（毫秒）
    token_input: Optional[int] = None  # 输入 token 数（如果 API 返回）
    token_output: Optional[int] = None  # 输出 token 数（如果 API 返回）
    status: str = "completed"  # pending, completed, error
    error_message: Optional[str] = None

    # 工具调用（如果有）
    tool_calls: Optional[List[Dict[str, Any]]] = None  # 工具调用列表

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v):
        return objectid_to_str(v)

    class Settings:
        name = "model_traces"
        indexes = [
            "user_id",
            "session_id",
            "message_id",
            "model",
            "created_at",
        ]

    class Config:
        populate_by_name = True


# Export
__all__ = ["ModelTrace"]