"""
Test multimodal message conversion in AI service
"""
import pytest
from app.services.ai_service import AIService


@pytest.fixture
def ai_service():
    """Get AI service instance"""
    return AIService()


class TestMultimodalConversion:
    """Test multimodal content conversion"""

    def test_is_multimodal_model(self, ai_service):
        """Test multimodal model detection"""
        # Models that support multimodal
        assert ai_service.is_multimodal_model("qwen3.5-plus") is True
        assert ai_service.is_multimodal_model("kimi-k2.5") is True
        assert ai_service.is_multimodal_model("Qwen3.5-plus") is True  # Case insensitive

        # Models that don't support multimodal
        assert ai_service.is_multimodal_model("qwen3-max-2026-01-23") is False
        assert ai_service.is_multimodal_model("glm-5") is False
        assert ai_service.is_multimodal_model("qwen3-coder-next") is False

    def test_convert_text_only_content(self, ai_service):
        """Test converting plain text content"""
        content = {"type": "text", "text": "Hello, world!"}

        # For any model, text should remain as string
        result = ai_service.convert_multimodal_content(content, "qwen3.5-plus")
        assert result == "Hello, world!"

        result = ai_service.convert_multimodal_content(content, "glm-5")
        assert result == "Hello, world!"

    def test_convert_mixed_content_with_supported_model(self, ai_service):
        """Test converting mixed content with multimodal model"""
        content = {
            "type": "mixed",
            "parts": [
                {"type": "image", "url": "http://example.com/image.jpg"},
                {"type": "text", "text": "What is this image?"}
            ]
        }

        # For multimodal model (qwen3.5-plus), should convert to OpenAI format
        result = ai_service.convert_multimodal_content(content, "qwen3.5-plus")

        assert isinstance(result, list)
        assert len(result) == 2

        # Find text and image parts
        text_part = next((p for p in result if p.get("type") == "text"), None)
        image_part = next((p for p in result if p.get("type") == "image_url"), None)

        assert text_part is not None
        assert text_part["text"] == "What is this image?"

        assert image_part is not None
        assert image_part["image_url"]["url"] == "http://example.com/image.jpg"

    def test_convert_mixed_content_with_unsupported_model(self, ai_service):
        """Test converting mixed content with non-multimodal model"""
        content = {
            "type": "mixed",
            "parts": [
                {"type": "image", "url": "http://example.com/image.jpg"},
                {"type": "text", "text": "What is this?"}
            ]
        }

        # For non-multimodal model (glm-5), should extract text only with warning
        result = ai_service.convert_multimodal_content(content, "glm-5")

        assert isinstance(result, str)
        assert "What is this?" in result
        assert "[提示：当前模型不支持图片理解" in result

    def test_convert_single_image_content(self, ai_service):
        """Test converting single image content"""
        content = {
            "type": "image",
            "url": "http://example.com/photo.png"
        }

        # With multimodal model
        result = ai_service.convert_multimodal_content(content, "qwen3.5-plus")
        assert isinstance(result, list)
        assert result[0]["type"] == "image_url"
        assert result[0]["image_url"]["url"] == "http://example.com/photo.png"

        # With non-multimodal model
        result = ai_service.convert_multimodal_content(content, "qwen3-max-2026-01-23")
        assert isinstance(result, str)
        assert "[提示：当前模型不支持图片理解" in result

    def test_convert_multiple_images(self, ai_service):
        """Test converting content with multiple images"""
        content = {
            "type": "mixed",
            "parts": [
                {"type": "image", "url": "http://example.com/img1.jpg"},
                {"type": "image", "url": "http://example.com/img2.jpg"},
                {"type": "text", "text": "Compare these images"}
            ]
        }

        result = ai_service.convert_multimodal_content(content, "kimi-k2.5")

        assert isinstance(result, list)
        # Should have 2 image parts + 1 text part
        image_parts = [p for p in result if p.get("type") == "image_url"]
        text_parts = [p for p in result if p.get("type") == "text"]

        assert len(image_parts) == 2
        assert len(text_parts) == 1
        assert text_parts[0]["text"] == "Compare these images"

    def test_convert_with_data_uri(self, ai_service):
        """Test converting content with base64 data URI"""
        content = {
            "type": "mixed",
            "parts": [
                {"type": "image", "url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."},
                {"type": "text", "text": "Analyze this"}
            ]
        }

        result = ai_service.convert_multimodal_content(content, "qwen3.5-plus")

        assert isinstance(result, list)
        image_part = next((p for p in result if p.get("type") == "image_url"), None)
        assert image_part is not None
        assert image_part["image_url"]["url"].startswith("data:image/jpeg;base64")