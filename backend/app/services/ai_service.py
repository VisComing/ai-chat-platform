"""
AI Service - Alibaba Cloud Bailian Platform Integration
Supports Deep Thinking models with reasoning content (qwen3-max)
"""
import httpx
import json
import asyncio
import os
import re
import base64
import logging
from typing import AsyncGenerator, Optional, List, Dict, Any, Tuple, Union
from dataclasses import dataclass
from app.core.config import get_settings

logger = logging.getLogger("app.ai")


def load_image_as_base64(file_path: str) -> str | None:
    """
    Load image from file path and convert to base64 data URI

    Args:
        file_path: Local file path or relative API path like /api/v1/files/{id}/download

    Returns:
        Base64 data URI string or None if file not found
    """
    # If it's a relative API path, we need to resolve the actual file path
    # The file would be stored in uploads/{user_id}/images/{filename}
    # For now, try to find the file in uploads directory
    upload_dir = get_settings().upload_dir

    # Try multiple possible locations
    possible_paths = [
        file_path,  # Direct path
        os.path.join(upload_dir, file_path.lstrip('/')),  # uploads/...
        os.path.join(upload_dir, 'images', file_path.split('/')[-1] if '/' in file_path else file_path),  # uploads/images/{filename}
    ]

    # Also search in user subdirectories
    for root, dirs, files in os.walk(upload_dir):
        for file in files:
            if file.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                # Check if this file matches the path pattern
                full_path = os.path.join(root, file)
                possible_paths.append(full_path)

    for path in possible_paths:
        if os.path.exists(path) and os.path.isfile(path):
            try:
                with open(path, 'rb') as f:
                    image_data = f.read()

                # Detect MIME type from extension
                ext = os.path.splitext(path)[1].lower()
                mime_map = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                }
                mime_type = mime_map.get(ext, 'image/jpeg')

                # Convert to base64 data URI
                b64_data = base64.b64encode(image_data).decode('utf-8')
                return f"data:{mime_type};base64,{b64_data}"
            except Exception as e:
                logger.error(f"Failed to load image {path}: {e}")
                continue

    return None


@dataclass
class ChatChunk:
    """Represents a chunk from chat completion"""
    type: str  # 'text', 'thinking', 'complete', 'error'
    content: str = ""


class AIService:
    """Alibaba Cloud Bailian AI Service"""

    # Models that support deep thinking (return reasoning_content)
    THINKING_MODELS = [
        'qwen3.5-plus',
        'qwen3-max',
        'qwen3-max-2026-01-23',
        'glm-5',
        'glm-4.7',
        'kimi-k2.5',
        'MiniMax-M2.5',
    ]

    # Models that support visual understanding (multimodal image input)
    MULTIMODAL_MODELS = [
        'qwen3.5-plus',
        'kimi-k2.5',
    ]

    def __init__(self):
        self.settings = get_settings()
        self.base_url = self.settings.bailian_base_url
        self.api_key = self.settings.bailian_api_key
        self.default_model = self.settings.default_model
        self.max_tokens = self.settings.max_tokens
        self.temperature = self.settings.default_temperature

    def is_thinking_model(self, model: str) -> bool:
        """Check if model supports deep thinking"""
        model_lower = model.lower()
        return any(m in model_lower for m in self.THINKING_MODELS)

    def is_multimodal_model(self, model: str) -> bool:
        """Check if model supports visual understanding (multimodal)"""
        model_lower = model.lower()
        return any(m in model_lower for m in self.MULTIMODAL_MODELS)

    def convert_multimodal_content(
        self,
        content: Dict[str, Any],
        model: str
    ) -> Union[str, List[Dict[str, Any]]]:
        """
        Convert unified message content format to model-specific format

        Args:
            content: MessageContent format, e.g. {"type": "mixed", "parts": [...]}
            model: Target model name

        Returns:
            Model-specific message content format
            - For text-only: returns string
            - For multimodal: returns OpenAI-compatible format list
        """
        content_type = content.get("type", "text")

        # Pure text message
        if content_type == "text":
            return content.get("text", "")

        # Handle multimodal messages (image, mixed types)
        parts = content.get("parts", [content]) if content_type == "mixed" else [content]

        text_parts = [p for p in parts if p.get("type") == "text"]
        image_parts = [p for p in parts if p.get("type") == "image"]

        # If no images, just return text
        if not image_parts:
            return " ".join([p.get("text", "") for p in text_parts])

        # Model doesn't support multimodal → extract text only with warning
        if not self.is_multimodal_model(model):
            text_content = " ".join([p.get("text", "") for p in text_parts])
            if image_parts:
                text_content += "\n[提示：当前模型不支持图片理解，已忽略图片内容]"
            return text_content

        # Model supports multimodal → convert to OpenAI format
        # Both qwen3.5-plus and kimi-k2.5 support OpenAI's multimodal format
        result = []

        # Add images first (some models prefer this order)
        for part in image_parts:
            url = part.get("url", "")
            if url:
                # Check if URL is already a data URI or remote URL
                if url.startswith("data:") or url.startswith("http"):
                    result.append({
                        "type": "image_url",
                        "image_url": {"url": url}
                    })
                else:
                    # It's a local file path or relative API path
                    # Convert to base64 data URI for AI API consumption
                    b64_uri = load_image_as_base64(url)
                    if b64_uri:
                        result.append({
                            "type": "image_url",
                            "image_url": {"url": b64_uri}
                        })
                        logger.debug(f"Converted image to base64: {url[:50]}...")
                    else:
                        logger.warning(f"Could not load image: {url}")
                        # Skip this image if we can't load it

        # Add text content
        text_content = " ".join([p.get("text", "") for p in text_parts])
        if text_content:
            result.append({
                "type": "text",
                "text": text_content
            })

        return result

    def _get_http_client(self) -> httpx.AsyncClient:
        """获取配置了代理的 httpx 客户端"""
        proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
        https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")

        if proxy or https_proxy:
            return httpx.AsyncClient(proxy=https_proxy or proxy, timeout=120.0)
        return httpx.AsyncClient(timeout=120.0)
    
    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        stream: bool = True,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Chat completion with streaming support

        Args:
            messages: List of message objects with role and content
            model: Model name (default: qwen3.5-plus)
            stream: Whether to stream the response
            **kwargs: Additional parameters

        Returns:
            AsyncGenerator yielding text chunks
        """
        model = model or self.default_model

        # Convert multimodal messages to model-specific format
        converted_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # If content is a dict (multimodal), convert it
            if isinstance(content, dict):
                converted_content = self.convert_multimodal_content(content, model)
            else:
                converted_content = content

            converted_messages.append({
                "role": role,
                "content": converted_content
            })

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "messages": converted_messages,
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
            "stream": stream
        }

        if stream:
            async with self._get_http_client() as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        raise Exception(f"AI API error: {response.status_code} - {error_text}")

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]  # Remove "data: " prefix

                            if data_str == "[DONE]":
                                break

                            try:
                                data = json.loads(data_str)
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
        else:
            async with self._get_http_client() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )

                if response.status_code != 200:
                    raise Exception(f"AI API error: {response.status_code} - {response.text}")

                data = response.json()
                if "choices" in data and len(data["choices"]) > 0:
                    message = data["choices"][0].get("message", {})
                    content = message.get("content", "")
                    yield content

    async def chat_completion_with_thinking(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[ChatChunk, None]:
        """Chat completion with deep thinking support (qwen3-max, etc.)"""
        model = model or self.default_model

        # Convert multimodal messages to model-specific format
        converted_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # If content is a dict (multimodal), convert it
            if isinstance(content, dict):
                converted_content = self.convert_multimodal_content(content, model)
            else:
                converted_content = content

            converted_messages.append({
                "role": role,
                "content": converted_content
            })

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "messages": converted_messages,
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
            "stream": True
        }

        async with self._get_http_client() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield ChatChunk(type="error", content=f"AI API error: {response.status_code}")
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]

                        if data_str == "[DONE]":
                            break

                        try:
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})

                                # Check for reasoning_content (thinking) from Bailian API
                                reasoning_content = delta.get("reasoning_content", "")
                                if reasoning_content:
                                    yield ChatChunk(type="thinking", content=reasoning_content)

                                # Check for normal content
                                content = delta.get("content", "")
                                if content:
                                    yield ChatChunk(type="text", content=content)

                        except json.JSONDecodeError:
                            continue

    async def chat_completion_sync(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Non-streaming chat completion
        
        Returns:
            Complete response text
        """
        result = []
        async for chunk in self.chat_completion(messages, model, stream=False, **kwargs):
            result.append(chunk)
        return "".join(result)
    
    def get_supported_models(self) -> List[str]:
        """Get list of supported models"""
        return self.settings.supported_models
    
    def is_model_supported(self, model: str) -> bool:
        """Check if model is supported"""
        return model in self.settings.supported_models
    
    async def generate_title(
        self,
        user_message: str,
        ai_response: str = "",
    ) -> str:
        """
        Generate a concise title for the conversation using LLM

        Args:
            user_message: First user message
            ai_response: First AI response (optional, helps context)

        Returns:
            Generated title string (max 10 characters)
        """
        # Build input content with conversation context
        ai_response_truncated = ai_response[:500] if len(ai_response) > 500 else ai_response
        input_content = f"用户: {user_message}\n助手: {ai_response_truncated}"

        # System prompt for title generation
        system_prompt = "基于以下对话，生成一个10字以内的标题，只返回标题"

        try:
            title = await self.chat_completion_sync(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": input_content},
                ],
                model=self.settings.title_generation_model,
                max_tokens=20,
                temperature=0.3,
            )

            logger.info(f"[Title Generation] AI raw: {title}")

            # Clean up the title
            title = title.strip().strip('"\'').strip()

            # Validate length (max 10 chars as per prompt)
            if len(title) < 2:
                return "新对话"
            if len(title) > 10:
                title = title[:10]

            logger.info(f"[Title Generation] Final: {title}")
            return title

        except Exception as e:
            logger.error(f"[Title Generation] AI failed: {e}")
            return "新对话"

    # Singleton instance
ai_service = AIService()