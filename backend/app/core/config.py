from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""

    # App
    app_name: str = "AI Chat Platform"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"

    # API
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "sqlite+aiosqlite:///./chat.db"
    database_echo: bool = False

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    secret_key: str = "your-secret-key-change-in-production"
    jwt_secret_key: str = "your-jwt-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS
    cors_origins: list[str] = ["*"]  # Allow all origins in development

    # AI Services - Alibaba Cloud Bailian Platform
    bailian_api_key: str = ""  # Required: Set via BAILIAN_API_KEY env var
    bailian_base_url: str = "https://coding.dashscope.aliyuncs.com/v1"
    default_model: str = "qwen3.5-plus"
    max_tokens: int = 4096
    default_temperature: float = 0.7
    
    # Supported models
    supported_models: list[str] = [
        "qwen3.5-plus",
        "qwen3-max-2026-01-23",
        "qwen3-coder-next",
        "qwen3-coder-plus",
        "glm-5",
        "glm-4.7",
        "kimi-k2.5",
        "MiniMax-M2.5",
    ]

    # Model capabilities
    # Models that support visual understanding (multimodal image input)
    multimodal_models: list[str] = [
        "qwen3.5-plus",
        "kimi-k2.5",
    ]

    # Models that support deep thinking (reasoning content)
    thinking_models: list[str] = [
        "qwen3.5-plus",
        "qwen3-max-2026-01-23",
        "glm-5",
        "glm-4.7",
        "kimi-k2.5",
        "MiniMax-M2.5",
    ]
    
    # Alibaba Cloud Search Service (IQS) - UnifiedSearch API
    alibaba_search_api_key: str = ""  # 从 .env 文件读取 ALIBABA_SEARCH_API_KEY
    alibaba_search_base_url: str = "https://cloud-iqs.aliyuncs.com"
    alibaba_search_endpoint: str = "/search/unified"
    alibaba_search_timeout: int = 30  # seconds (increased for network issues)
    
    # Agent Settings
    enable_search_agent: bool = True
    search_max_results: int = 5
    agent_max_iterations: int = 3

    # Deep Research Settings
    deep_research_max_iterations: int = 5  # 每个子任务最大迭代次数
    deep_research_max_time_seconds: int = 600  # 总研究时间上限（10分钟）
    deep_research_enable_clarification: bool = True  # 是否启用范围澄清
    deep_research_target_score: float = 0.8  # 信息充足的目标评估分数
    deep_research_default_model: str = "qwen3-max-2026-01-23"  # 推荐使用推理能力强的模型

    # File Storage
    upload_dir: str = "./uploads"
    max_file_size: int = 10 * 1024 * 1024  # 10MB

    # Doubao ASR (Volcano Engine Speech Recognition)
    doubao_asr_appid: str = ""
    doubao_asr_token: str = ""
    doubao_asr_secret_key: str = ""
    doubao_asr_cluster: str = "volcengine_streaming_common"
    doubao_asr_ws_url: str = "wss://openspeech.bytedance.com/api/v2/asr"

    # ASR Audio Enhancement Settings
    asr_enable_itn: bool = True          # Inverse Text Normalization (数字/日期格式化)
    asr_enable_punctuation: bool = True  # 自动标点
    asr_vad_silence_time: int = 800      # VAD静音阈值(ms)，嘈杂环境建议降低
    asr_enable_vad: bool = True          # VAD语音活动检测

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
