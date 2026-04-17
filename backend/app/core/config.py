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

    # Database - MongoDB
    mongodb_url: str = "mongodb://localhost:27017"  # MongoDB Atlas URL in production
    mongodb_db_name: str = "ai_chat_platform"
    mongodb_max_pool_size: int = 10
    mongodb_min_pool_size: int = 1

    # Redis (optional, for future use)
    redis_url: str = "redis://localhost:6379/0"

    # Huey Task Queue Settings
    huey_sqlite_path: str = "./huey.db"  # Huey SQLite 数据库路径
    huey_worker_threads: int = 2  # Worker 线程数

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
    default_model: str = "deepseek-chat"
    max_tokens: int = 4096
    default_temperature: float = 0.7

    # DeepSeek API (OpenAI compatible)
    deepseek_api_key: str = ""  # Required: Set via DEEPSEEK_API_KEY env var
    deepseek_base_url: str = "https://api.deepseek.com"

    # Supported models
    supported_models: list[str] = [
        "deepseek-chat",
        "deepseek-reasoner",
    ]

    # Model capabilities
    # Models that support visual understanding (multimodal image input)
    multimodal_models: list[str] = []

    # Models that support deep thinking (reasoning content)
    thinking_models: list[str] = [
        "deepseek-reasoner",
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
    deep_research_default_model: str = "deepseek-reasoner"  # 推荐使用推理能力强的模型
    deep_research_poll_interval: int = 3  # 前端轮询间隔（秒）

    # Title Generation - Use lightweight model for cost optimization
    title_generation_model: str = "deepseek-chat"  # 轻量模型，降低成本

    # Sandbox Settings (Local Docker)
    sandbox_container_image: str = "python:3.12-slim"
    sandbox_cpu_limit: int = 1  # CPU 核数
    sandbox_memory_limit: str = "512m"  # 内存限制
    sandbox_timeout: int = 60  # 执行超时（秒）
    sandbox_pool_size: int = 3  # 容器池大小
    sandbox_enabled: bool = False  # 是否启用沙箱（开发阶段默认关闭）

    # File Storage Settings
    upload_dir: str = "./uploads"
    research_report_dir: str = "./uploads/research"  # 研究报告目录
    max_report_size: int = 10 * 1024 * 1024  # 最大报告文件大小 (10MB)
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

    # Logging Settings
    log_level: str = "DEBUG"
    log_dir: str = "./logs"
    log_file: str = "app.log"
    log_max_bytes: int = 10 * 1024 * 1024  # 10MB
    log_backup_count: int = 5
    log_format: str = "%(asctime)s - %(levelname)s - %(name)s - %(message)s"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
