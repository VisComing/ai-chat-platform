"""
Deep Research Utilities - LLM 创建和 JSON 解析工具函数
"""
import json
import logging
from typing import Dict, Any
from langchain_openai import ChatOpenAI
import httpx
import os

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def create_llm(model: str = None) -> ChatOpenAI:
    """创建 LLM 实例"""
    settings = get_settings()
    model = model or settings.default_model

    proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")

    http_client = None
    if proxy or https_proxy:
        http_client = httpx.AsyncClient(
            proxy=https_proxy or proxy,
            timeout=60.0
        )

    return ChatOpenAI(
        model=model,
        openai_api_key=settings.bailian_api_key,
        openai_api_base=settings.bailian_base_url,
        temperature=0.3,
        max_tokens=settings.max_tokens,
        http_async_client=http_client,
    )


def parse_llm_json_response(response_content: str) -> Dict[str, Any]:
    """解析LLM返回的JSON响应"""
    try:
        content = response_content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {e}, content: {response_content[:200]}")
        return {}