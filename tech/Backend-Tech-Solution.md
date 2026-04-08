# AI对话平台后端技术方案

**版本**: v1.0  
**日期**: 2026-04-03  
**技术栈**: Python 3.12 + FastAPI + PostgreSQL + Redis  
**负责人**: 后端技术团队

---

## 一、技术选型

### 1.1 核心框架

| 技术 | 版本 | 选型理由 |
|-----|------|---------|
| Python | 3.12 | 最新稳定版、性能优化、类型提示增强 |
| FastAPI | 0.115+ | 高性能异步框架、自动API文档、类型验证 |
| Uvicorn | 0.32+ | ASGI服务器、高性能、支持HTTP/2 |
| PostgreSQL | 16+ | 关系型数据库、JSON支持、全文搜索 |
| Redis | 7+ | 缓存、会话存储、消息队列、实时通信 |
| SQLAlchemy | 2.0+ | ORM框架、异步支持、类型安全 |
| Alembic | 1.13+ | 数据库迁移工具 |

### 1.2 AI集成

| 技术 | 用途 |
|-----|------|
| OpenAI SDK | GPT模型调用 |
| Anthropic SDK | Claude模型调用 |
| LangChain | LLM编排、工具调用 |
| LlamaIndex | RAG知识库检索 |
| Transformers | 本地模型推理 |

### 1.3 辅助库

| 库名 | 用途 |
|-----|------|
| Pydantic | 数据验证、模型定义 |
| httpx | 异步HTTP客户端 |
| python-multipart | 文件上传处理 |
| aiofiles | 异步文件操作 |
| PyJWT | JWT认证 |
| passlib | 密码加密 |
| python-dotenv | 环境变量 |
| loguru | 日志管理 |
| pytest | 单元测试 |
| celery | 异步任务队列 |

### 1.4 基础设施

| 服务 | 用途 |
|-----|------|
| Docker | 容器化部署 |
| Kubernetes | 集群管理 |
| Prometheus | 监控指标 |
| Grafana | 监控可视化 |
| ELK Stack | 日志收集分析 |
| Nginx | 反向代理、负载均衡 |

---

## 二、项目架构

### 2.1 目录结构

```
ai-chat-backend/
├── app/                          # 应用主目录
│   ├── __init__.py
│   ├── main.py                   # FastAPI入口
│   ├── config.py                 # 配置管理
│   ├── dependencies.py           # 依赖注入
│   │
│   ├── api/                      # API路由
│   │   ├── __init__.py
│   │   ├── v1/                   # API版本v1
│   │   │   ├── __init__.py
│   │   │   ├── router.py         # 路由汇总
│   │   │   ├── chat.py           # 对话API
│   │   │   ├── sessions.py       # 会话API
│   │   │   ├── files.py          # 文件API
│   │   │   ├── agents.py         # Agent API
│   │   │   ├── knowledge.py      # 知识库API
│   │   │   ├── auth.py           # 认证API
│   │   │   ├── users.py          # 用户API
│   │   │   └── search.py         # 搜索API
│   │   └── websocket.py          # WebSocket路由
│   │
│   ├── core/                     # 核心模块
│   │   ├── __init__.py
│   │   ├── security.py           # 安全模块
│   │   ├── exceptions.py         # 异常处理
│   │   ├── middleware.py         # 中间件
│   │   ├── logging.py            # 日志配置
│   │   └── cache.py              # 缓存管理
│   │
│   ├── models/                   # 数据模型
│   │   ├── __init__.py
│   │   ├── base.py               # 基础模型
│   │   ├── user.py               # 用户模型
│   │   ├── session.py            # 会话模型
│   │   ├── message.py            # 消息模型
│   │   ├── file.py               # 文件模型
│   │   ├── agent.py              # Agent模型
│   │   ├── knowledge.py          # 知识库模型
│   │   └── settings.py           # 设置模型
│   │
│   ├── schemas/                  # Pydantic模型
│   │   ├── __init__.py
│   │   ├── base.py               # 基础Schema
│   │   ├── user.py               # 用户Schema
│   │   ├── session.py            # 会话Schema
│   │   ├── message.py            # 消息Schema
│   │   ├── file.py               # 文件Schema
│   │   ├── agent.py              # Agent Schema
│   │   ├── knowledge.py          # 知识库Schema
│   │   ├── chat.py               # 对话请求/响应Schema
│   │   └── auth.py               # 认证Schema
│   │
│   ├── services/                 # 业务服务
│   │   ├── __init__.py
│   │   ├── chat_service.py       # 对话服务
│   │   ├── session_service.py    # 会话服务
│   │   ├── file_service.py       # 文件服务
│   │   ├── agent_service.py      # Agent服务
│   │   ├── knowledge_service.py  # 知识库服务
│   │   ├── auth_service.py       # 认证服务
│   │   ├── user_service.py       # 用户服务
│   │   ├── search_service.py     # 搜索服务
│   │   ├── llm_service.py        # LLM调用服务
│   │   └── embedding_service.py  # 向量嵌入服务
│   │
│   ├── repositories/             # 数据访问层
│   │   ├── __init__.py
│   │   ├── base.py               # 基础Repository
│   │   ├── user_repo.py          # 用户Repository
│   │   ├── session_repo.py       # 会话Repository
│   │   ├── message_repo.py       # 消息Repository
│   │   ├── file_repo.py          # 文件Repository
│   │   ├── agent_repo.py         # Agent Repository
│   │   └── knowledge_repo.py     # 知识库Repository
│   │
│   ├── workers/                  # 异步任务
│   │   ├── __init__.py
│   │   ├── celery_app.py         # Celery配置
│   │   ├── tasks.py              # 任务定义
│   │   ├── file_processor.py     # 文件处理任务
│   │   ├── agent_executor.py     # Agent执行任务
│   │   └── scheduler.py          # 定时任务
│   │
│   ├── llm/                      # LLM集成
│   │   ├── __init__.py
│   │   ├── base.py               # LLM基类
│   │   ├── openai.py             # OpenAI集成
│   │   ├── anthropic.py          # Anthropic集成
│   │   ├── local.py              # 本地模型
│   │   ├── router.py             # 模型路由
│   │   ├── tools.py              # 工具定义
│   │   └── prompts.py            # 提示词模板
│   │
│   ├── rag/                      # RAG模块
│   │   ├── __init__.py
│   │   ├── indexer.py            # 文档索引
│   │   ├── retriever.py          # 文档检索
│   │   ├── chunker.py            # 文档分块
│   │   ├── reranker.py           # 结果重排序
│   │   └── vector_store.py       # 向量存储
│   │
│   └── utils/                    # 工具函数
│       ├── __init__.py
│       ├── helpers.py            # 辅助函数
│       ├── validators.py         # 验证函数
│       ├── crypto.py             # 加密工具
│       ├── file_utils.py         # 文件处理
│       └── streaming.py          # 流式处理
│
├── migrations/                   # 数据库迁移
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
│
├── tests/                        # 测试目录
│   ├── __init__.py
│   ├── conftest.py               # 测试配置
│   ├── unit/                     # 单元测试
│   │   ├── test_services/
│   │   ├── test_repositories/
│   │   └── test_llm/
│   ├── integration/              # 集成测试
│   │   ├── test_api/
│   │   └── test_db/
│   └── e2e/                      # E2E测试
│       ├── test_chat_flow.py
│       └── test_agent_flow.py
│
├── scripts/                      # 脚本目录
│   ├── init_db.py                # 初始化数据库
│   ├── seed_data.py              # 种子数据
│   └── deploy.sh                 # 部署脚本
│
├── docs/                         # 文档目录
│   ├── api/                      # API文档
│   ├── architecture/             # 架构文档
│   └── deployment/               # 部署文档
│
├── .env.example                  # 环境变量示例
├── .gitignore
├── pyproject.toml                # 项目配置
├── requirements.txt              # 依赖列表
├── Dockerfile                    # Docker配置
├── docker-compose.yml            # Docker Compose
├── Makefile                      # 常用命令
└── README.md                     # 项目说明
```

### 2.2 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                      API层 (FastAPI)                         │
│  路由定义、请求验证、响应格式化、异常处理                       │
├─────────────────────────────────────────────────────────────┤
│                      服务层 (Services)                       │
│  业务逻辑、事务管理、跨模块协调、事件发布                       │
├─────────────────────────────────────────────────────────────┤
│                      数据访问层 (Repositories)                │
│  CRUD操作、查询构建、数据映射、缓存策略                         │
├─────────────────────────────────────────────────────────────┤
│                      模型层 (Models)                         │
│  数据模型定义、关系映射、约束验证                               │
├─────────────────────────────────────────────────────────────┤
│                      基础设施层                              │
│  数据库、缓存、消息队列、LLM、向量存储                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、核心模块设计

### 3.1 对话服务模块

#### 3.1.1 对话流程架构

```
用户请求 → API层验证
    ↓
ChatService处理
    ↓
├── 创建用户消息
├── 构建上下文（历史消息 + 系统提示词）
├── 调用LLM服务
│   ├── 模型路由选择
│   ├── 提示词构建
│   ├── 工具调用判断
│   └── 流式生成响应
├── 创建AI消息
├── 更新会话状态
└── 返回流式响应
```

#### 3.1.2 核心代码实现

```python
# app/services/chat_service.py
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.message_repo import MessageRepository
from app.repositories.session_repo import SessionRepository
from app.llm.router import LLMRouter
from app.schemas.chat import ChatRequest, ChatResponse, StreamChunk

class ChatService:
    def __init__(
        self,
        db: AsyncSession,
        message_repo: MessageRepository,
        session_repo: SessionRepository,
        llm_router: LLMRouter,
    ):
        self.db = db
        self.message_repo = message_repo
        self.session_repo = session_repo
        self.llm_router = llm_router

    async def chat_stream(
        self,
        request: ChatRequest,
        user_id: str,
    ) -> AsyncGenerator[StreamChunk, None]:
        """流式对话处理"""
        
        # 1. 获取会话
        session = await self.session_repo.get_by_id(request.session_id)
        if not session or session.user_id != user_id:
            raise ValueError("会话不存在或无权限")

        # 2. 创建用户消息
        user_message = await self.message_repo.create(
            session_id=session.id,
            role="user",
            content=request.content,
            metadata=request.metadata,
        )

        # 3. 构建对话上下文
        history = await self.message_repo.get_session_messages(
            session_id=session.id,
            limit=request.context_limit or 10,
        )
        context = self._build_context(
            history=history,
            system_prompt=session.system_prompt,
            user_message=user_message,
        )

        # 4. 创建临时AI消息
        ai_message = await self.message_repo.create(
            session_id=session.id,
            role="assistant",
            content={"type": "text", "text": ""},
            status="streaming",
        )

        # 5. 流式调用LLM
        accumulated_text = ""
        thinking_content = ""
        
        try:
            async for chunk in self.llm_router.stream_chat(
                model=request.model or session.default_model,
                messages=context,
                tools=request.tools,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                enable_thinking=request.enable_thinking,
            ):
                # 处理不同类型的chunk
                if chunk.type == "thinking":
                    thinking_content += chunk.content
                    yield StreamChunk(
                        type="thinking",
                        content=chunk.content,
                        message_id=ai_message.id,
                    )
                
                elif chunk.type == "text":
                    accumulated_text += chunk.content
                    # 更新消息内容
                    await self.message_repo.update(
                        id=ai_message.id,
                        content={"type": "text", "text": accumulated_text},
                    )
                    yield StreamChunk(
                        type="text",
                        content=chunk.content,
                        message_id=ai_message.id,
                    )
                
                elif chunk.type == "tool_call":
                    # 工具调用
                    tool_result = await self._execute_tool(
                        tool_name=chunk.tool_name,
                        tool_args=chunk.tool_args,
                    )
                    yield StreamChunk(
                        type="tool_call",
                        tool_name=chunk.tool_name,
                        tool_result=tool_result,
                        message_id=ai_message.id,
                    )
                
                elif chunk.type == "complete":
                    # 完成响应
                    metadata = {
                        "model": chunk.model,
                        "tokens": {
                            "input": chunk.input_tokens,
                            "output": chunk.output_tokens,
                        },
                        "duration": chunk.duration,
                        "thinking": thinking_content if thinking_content else None,
                    }
                    
                    await self.message_repo.update(
                        id=ai_message.id,
                        status="completed",
                        metadata=metadata,
                    )
                    
                    # 更新会话
                    await self.session_repo.update(
                        id=session.id,
                        message_count=session.message_count + 2,
                        last_message_at=datetime.utcnow(),
                    )
                    
                    yield StreamChunk(
                        type="complete",
                        message_id=ai_message.id,
                        metadata=metadata,
                    )

        except Exception as e:
            # 错误处理
            await self.message_repo.update(
                id=ai_message.id,
                status="error",
                content={"type": "text", "text": str(e)},
            )
            yield StreamChunk(
                type="error",
                message=str(e),
                message_id=ai_message.id,
            )

    def _build_context(
        self,
        history: list[Message],
        system_prompt: Optional[str],
        user_message: Message,
    ) -> list[dict]:
        """构建对话上下文"""
        messages = []
        
        # 系统提示词
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt,
            })
        
        # 历史消息
        for msg in history:
            messages.append({
                "role": msg.role,
                "content": self._format_content(msg.content),
            })
        
        # 当前用户消息
        messages.append({
            "role": "user",
            "content": self._format_content(user_message.content),
        })
        
        return messages

    def _format_content(self, content: dict) -> str | list[dict]:
        """格式化消息内容"""
        if content["type"] == "text":
            return content["text"]
        elif content["type"] == "mixed":
            return [
                {"type": "text", "text": part["text"]}
                if part["type"] == "text"
                else {"type": "image_url", "image_url": {"url": part["url"]}}
                for part in content["parts"]
            ]
        return content
```

#### 3.1.3 SSE流式响应实现

```python
# app/api/v1/chat.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from app.services.chat_service import ChatService
from app.schemas.chat import ChatRequest

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service),
):
    """流式对话接口"""
    
    async def event_generator():
        try:
            async for chunk in chat_service.chat_stream(
                request=request,
                user_id=current_user.id,
            ):
                # SSE格式
                yield {
                    "event": chunk.type,
                    "data": json.dumps(chunk.dict()),
                }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": str(e)}),
            }
    
    return EventSourceResponse(event_generator())
```

### 3.2 LLM集成模块

#### 3.2.1 LLM路由器

```python
# app/llm/router.py
from typing import AsyncGenerator, Optional
from app.llm.base import BaseLLM
from app.llm.openai import OpenAILLM
from app.llm.anthropic import AnthropicLLM
from app.llm.local import LocalLLM
from app.config import settings

class LLMRouter:
    """LLM模型路由器"""
    
    def __init__(self):
        self.providers = {
            "openai": OpenAILLM(api_key=settings.OPENAI_API_KEY),
            "anthropic": AnthropicLLM(api_key=settings.ANTHROPIC_API_KEY),
            "local": LocalLLM(model_path=settings.LOCAL_MODEL_PATH),
        }
        
        # 模型映射
        self.model_mapping = {
            "gpt-4": "openai",
            "gpt-4-turbo": "openai",
            "gpt-3.5-turbo": "openai",
            "claude-3-opus": "anthropic",
            "claude-3-sonnet": "anthropic",
            "claude-3-haiku": "anthropic",
            "local-model": "local",
        }

    def get_provider(self, model: str) -> BaseLLM:
        """获取模型对应的Provider"""
        provider_name = self.model_mapping.get(model)
        if not provider_name:
            raise ValueError(f"不支持的模型: {model}")
        return self.providers[provider_name]

    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        enable_thinking: bool = False,
    ) -> AsyncGenerator[LLMChunk, None]:
        """流式对话"""
        provider = self.get_provider(model)
        
        async for chunk in provider.stream_chat(
            model=model,
            messages=messages,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
            enable_thinking=enable_thinking,
        ):
            yield chunk

    async def chat(
        self,
        model: str,
        messages: list[dict],
        **kwargs,
    ) -> LLMResponse:
        """非流式对话"""
        provider = self.get_provider(model)
        return await provider.chat(model=model, messages=messages, **kwargs)
```

#### 3.2.2 OpenAI集成

```python
# app/llm/openai.py
from openai import AsyncOpenAI
from typing import AsyncGenerator, Optional
from app.llm.base import BaseLLM, LLMChunk, LLMResponse

class OpenAILLM(BaseLLM):
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)

    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        enable_thinking: bool = False,
    ) -> AsyncGenerator[LLMChunk, None]:
        """OpenAI流式对话"""
        
        # 构建请求参数
        params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        
        if tools:
            params["tools"] = tools
        
        # 流式调用
        stream = await self.client.chat.completions.create(**params)
        
        input_tokens = 0
        output_tokens = 0
        start_time = time.time()
        accumulated_text = ""
        thinking_text = ""
        
        for chunk in stream:
            # 处理usage信息
            if chunk.usage:
                input_tokens = chunk.usage.prompt_tokens
                output_tokens = chunk.usage.completion_tokens
            
            # 处理内容
            if chunk.choices:
                delta = chunk.choices[0].delta
                
                # 思考过程（o1模型）
                if hasattr(delta, "reasoning_content") and delta.reasoning_content:
                    thinking_text += delta.reasoning_content
                    yield LLMChunk(
                        type="thinking",
                        content=delta.reasoning_content,
                    )
                
                # 正常内容
                if delta.content:
                    accumulated_text += delta.content
                    yield LLMChunk(
                        type="text",
                        content=delta.content,
                    )
                
                # 工具调用
                if delta.tool_calls:
                    for tool_call in delta.tool_calls:
                        yield LLMChunk(
                            type="tool_call",
                            tool_name=tool_call.function.name,
                            tool_args=json.loads(tool_call.function.arguments),
                        )
                
                # 完成
                if chunk.choices[0].finish_reason:
                    yield LLMChunk(
                        type="complete",
                        model=model,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        duration=time.time() - start_time,
                    )

    async def chat(
        self,
        model: str,
        messages: list[dict],
        **kwargs,
    ) -> LLMResponse:
        """非流式对话"""
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            stream=False,
            **kwargs,
        )
        
        return LLMResponse(
            content=response.choices[0].message.content,
            model=model,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
        )
```

### 3.3 知识库模块（RAG）

#### 3.3.1 文档处理流程

```
文档上传 → 文件解析
    ↓
文档分块（Chunker）
    ↓
向量嵌入（Embedding）
    ↓
向量存储（Vector Store）
    ↓
检索时：
    ↓
查询向量化 → 向量检索 → 重排序 → 返回相关文档
```

#### 3.3.2 文档索引实现

```python
# app/rag/indexer.py
from typing import List
from langchain.text_splitter import RecursiveCharacterTextSplitter
from app.rag.chunker import DocumentChunker
from app.rag.embedder import EmbeddingService
from app.rag.vector_store import VectorStore
from app.repositories.knowledge_repo import KnowledgeRepository

class DocumentIndexer:
    def __init__(
        self,
        chunker: DocumentChunker,
        embedder: EmbeddingService,
        vector_store: VectorStore,
        knowledge_repo: KnowledgeRepository,
    ):
        self.chunker = chunker
        self.embedder = embedder
        self.vector_store = vector_store
        self.knowledge_repo = knowledge_repo

    async def index_document(
        self,
        file_path: str,
        knowledge_base_id: str,
        metadata: dict = None,
    ) -> IndexResult:
        """索引文档"""
        
        # 1. 解析文档
        document = await self.chunker.parse_document(file_path)
        
        # 2. 文档分块
        chunks = await self.chunker.chunk_document(
            document=document,
            chunk_size=500,
            chunk_overlap=50,
        )
        
        # 3. 向量嵌入
        embeddings = await self.embedder.embed_batch(
            texts=[chunk.content for chunk in chunks],
        )
        
        # 4. 存储向量
        chunk_ids = await self.vector_store.add_vectors(
            vectors=embeddings,
            metadata=[
                {
                    "knowledge_base_id": knowledge_base_id,
                    "document_id": document.id,
                    "chunk_index": i,
                    "content": chunk.content,
                    "source": chunk.source,
                    **(metadata or {}),
                }
                for i, chunk in enumerate(chunks)
            ],
        )
        
        # 5. 更新知识库状态
        await self.knowledge_repo.update(
            id=knowledge_base_id,
            document_count=+1,
            chunk_count=+len(chunks),
            status="indexed",
        )
        
        return IndexResult(
            document_id=document.id,
            chunk_count=len(chunks),
            chunk_ids=chunk_ids,
        )

    async def delete_document(
        self,
        document_id: str,
        knowledge_base_id: str,
    ):
        """删除文档索引"""
        await self.vector_store.delete_by_filter(
            filter={"document_id": document_id}
        )
        await self.knowledge_repo.update(
            id=knowledge_base_id,
            document_count=-1,
        )
```

#### 3.3.3 文档检索实现

```python
# app/rag/retriever.py
from typing import List, Optional
from app.rag.embedder import EmbeddingService
from app.rag.vector_store import VectorStore
from app.rag.reranker import Reranker

class DocumentRetriever:
    def __init__(
        self,
        embedder: EmbeddingService,
        vector_store: VectorStore,
        reranker: Optional[Reranker] = None,
    ):
        self.embedder = embedder
        self.vector_store = vector_store
        self.reranker = reranker

    async def retrieve(
        self,
        query: str,
        knowledge_base_ids: List[str],
        top_k: int = 10,
        rerank: bool = True,
        threshold: float = 0.7,
    ) -> List[RetrievedDocument]:
        """检索相关文档"""
        
        # 1. 查询向量化
        query_embedding = await self.embedder.embed(query)
        
        # 2. 向量检索
        results = await self.vector_store.search(
            vector=query_embedding,
            filter={
                "knowledge_base_id": {"$in": knowledge_base_ids}
            },
            top_k=top_k * 2 if rerank else top_k,  # 重排序时多检索一些
        )
        
        # 3. 过滤低相关性结果
        results = [r for r in results if r.score >= threshold]
        
        # 4. 重排序（可选）
        if rerank and self.reranker and results:
            results = await self.reranker.rerank(
                query=query,
                documents=results,
                top_k=top_k,
            )
        
        return results[:top_k]

    async def retrieve_with_context(
        self,
        query: str,
        knowledge_base_ids: List[str],
        max_tokens: int = 4000,
    ) -> str:
        """检索并构建上下文"""
        documents = await self.retrieve(
            query=query,
            knowledge_base_ids=knowledge_base_ids,
        )
        
        # 构建上下文文本
        context_parts = []
        total_tokens = 0
        
        for doc in documents:
            # 估算token数（粗略：4字符≈1token）
            estimated_tokens = len(doc.content) // 4
            
            if total_tokens + estimated_tokens > max_tokens:
                break
            
            context_parts.append(
                f"【来源：{doc.source}】\n{doc.content}\n"
            )
            total_tokens += estimated_tokens
        
        return "\n".join(context_parts)
```

### 3.4 Agent模块

#### 3.4.1 Agent执行架构

```
任务定义 → AgentService
    ↓
任务规划（分解为子任务）
    ↓
执行引擎
    ├── 工具调用
    ├── 状态管理
    ├── 进度追踪
    └── 结果聚合
    ↓
任务完成 → 结果返回
```

#### 3.4.2 Agent服务实现

```python
# app/services/agent_service.py
from typing import List, Optional, AsyncGenerator
from enum import Enum
from app.repositories.agent_repo import AgentRepository
from app.llm.router import LLMRouter
from app.llm.tools import ToolRegistry

class AgentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"

class AgentService:
    def __init__(
        self,
        agent_repo: AgentRepository,
        llm_router: LLMRouter,
        tool_registry: ToolRegistry,
    ):
        self.agent_repo = agent_repo
        self.llm_router = llm_router
        self.tool_registry = tool_registry

    async def execute_agent(
        self,
        agent_id: str,
        task: str,
        context: dict = None,
        tools: List[str] = None,
    ) -> AsyncGenerator[AgentStep, None]:
        """执行Agent任务"""
        
        # 1. 获取Agent配置
        agent = await self.agent_repo.get_by_id(agent_id)
        if not agent:
            raise ValueError("Agent不存在")
        
        # 2. 创建执行记录
        execution = await self.agent_repo.create_execution(
            agent_id=agent.id,
            task=task,
            status=AgentStatus.RUNNING,
        )
        
        # 3. 构建工具列表
        available_tools = []
        if tools:
            for tool_name in tools:
                tool = self.tool_registry.get_tool(tool_name)
                if tool:
                    available_tools.append(tool)
        
        # 4. 执行任务
        messages = [
            {"role": "system", "content": agent.system_prompt},
            {"role": "user", "content": task},
        ]
        
        step_count = 0
        max_steps = agent.max_steps or 20
        
        try:
            while step_count < max_steps:
                step_count += 1
                
                # 调用LLM
                response = await self.llm_router.chat(
                    model=agent.model,
                    messages=messages,
                    tools=available_tools,
                )
                
                # 记录步骤
                step = AgentStep(
                    execution_id=execution.id,
                    step_number=step_count,
                    action=response.content,
                )
                
                # 检查是否有工具调用
                if response.tool_calls:
                    for tool_call in response.tool_calls:
                        # 执行工具
                        tool_result = await self.tool_registry.execute(
                            tool_name=tool_call.name,
                            args=tool_call.args,
                        )
                        
                        step.tool_calls.append({
                            "name": tool_call.name,
                            "args": tool_call.args,
                            "result": tool_result,
                        })
                        
                        # 添加工具结果到消息
                        messages.append({
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [tool_call],
                        })
                        messages.append({
                            "role": "tool",
                            "content": tool_result,
                            "tool_call_id": tool_call.id,
                        })
                        
                        yield AgentStep(
                            type="tool_call",
                            tool_name=tool_call.name,
                            tool_result=tool_result,
                        )
                else:
                    # 任务完成
                    messages.append({
                        "role": "assistant",
                        "content": response.content,
                    })
                    
                    # 更新执行状态
                    await self.agent_repo.update_execution(
                        id=execution.id,
                        status=AgentStatus.COMPLETED,
                        result=response.content,
                        steps=step_count,
                    )
                    
                    yield AgentStep(
                        type="complete",
                        result=response.content,
                    )
                    break

        except Exception as e:
            await self.agent_repo.update_execution(
                id=execution.id,
                status=AgentStatus.FAILED,
                error=str(e),
            )
            yield AgentStep(type="error", message=str(e))
```

### 3.5 文件处理模块

#### 3.5.1 文件上传处理

```python
# app/services/file_service.py
import aiofiles
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from app.repositories.file_repo import FileRepository
from app.utils.file_utils import FileProcessor

class FileService:
    def __init__(
        self,
        file_repo: FileRepository,
        storage_path: str = "/data/files",
        max_size: int = 10 * 1024 * 1024,  # 10MB
    ):
        self.file_repo = file_repo
        self.storage_path = Path(storage_path)
        self.max_size = max_size
        self.processor = FileProcessor()

    async def upload_file(
        self,
        file: UploadFile,
        user_id: str,
        session_id: Optional[str] = None,
    ) -> UploadedFile:
        """上传文件"""
        
        # 1. 验证文件大小
        if file.size > self.max_size:
            raise ValueError(f"文件大小超过限制 {self.max_size / 1024 / 1024}MB")
        
        # 2. 生成文件ID和路径
        file_id = generate_uuid()
        file_ext = Path(file.filename).suffix
        file_path = self.storage_path / user_id / f"{file_id}{file_ext}"
        
        # 3. 保存文件
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)
        
        # 4. 解析文件内容
        parsed_content = await self.processor.parse(file_path, file.content_type)
        
        # 5. 创建文件记录
        file_record = await self.file_repo.create(
            id=file_id,
            user_id=user_id,
            session_id=session_id,
            name=file.filename,
            path=str(file_path),
            size=file.size,
            mime_type=file.content_type,
            content=parsed_content,
        )
        
        return UploadedFile(
            id=file_id,
            name=file.filename,
            url=f"/api/files/{file_id}",
            size=file.size,
            mime_type=file.content_type,
        )

    async def get_file(
        self,
        file_id: str,
        user_id: str,
    ) -> FileRecord:
        """获取文件"""
        file = await self.file_repo.get_by_id(file_id)
        if not file or file.user_id != user_id:
            raise ValueError("文件不存在或无权限")
        return file

    async def delete_file(
        self,
        file_id: str,
        user_id: str,
    ):
        """删除文件"""
        file = await self.get_file(file_id, user_id)
        
        # 删除物理文件
        file_path = Path(file.path)
        if file_path.exists():
            file_path.unlink()
        
        # 删除记录
        await self.file_repo.delete(file_id)
```

---

## 四、数据库设计

### 4.1 数据模型

```python
# app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class User(BaseModel):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    avatar = Column(String(500))
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # 关系
    sessions = relationship("Session", back_populates="user")
    files = relationship("File", back_populates="user")
    settings = relationship("UserSettings", back_populates="user", uselist=False)

# app/models/session.py
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Session(BaseModel):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200))
    system_prompt = Column(Text)
    default_model = Column(String(50), default="gpt-4")
    pinned = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)
    message_count = Column(Integer, default=0)
    last_message_at = Column(DateTime)
    metadata = Column(JSON)
    
    # 关系
    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", order_by="Message.created_at")

# app/models/message.py
from sqlalchemy import Column, String, ForeignKey, DateTime, JSON, Enum
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Message(BaseModel):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False, index=True)
    role = Column(Enum("user", "assistant", "system"), nullable=False)
    content = Column(JSON, nullable=False)
    status = Column(
        Enum("pending", "streaming", "completed", "error", "cancelled"),
        default="completed"
    )
    metadata = Column(JSON)
    created_at = Column(DateTime, nullable=False, index=True)
    updated_at = Column(DateTime)
    
    # 关系
    session = relationship("Session", back_populates="messages")

# app/models/file.py
from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class File(BaseModel):
    __tablename__ = "files"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    session_id = Column(String(36), ForeignKey("sessions.id"))
    name = Column(String(255), nullable=False)
    path = Column(String(500), nullable=False)
    size = Column(Integer, nullable=False)
    mime_type = Column(String(100))
    content = Column(Text)  # 解析后的文本内容
    
    # 关系
    user = relationship("User", back_populates="files")
```

### 4.2 数据库索引策略

```sql
-- 会话表索引
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_pinned ON sessions(pinned) WHERE pinned = true;
CREATE INDEX idx_sessions_archived ON sessions(archived) WHERE archived = false;
CREATE INDEX idx_sessions_last_message ON sessions(last_message_at DESC);

-- 消息表索引
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_role_status ON messages(role, status);

-- 文件表索引
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_session_id ON files(session_id);
CREATE INDEX idx_files_mime_type ON files(mime_type);

-- 全文搜索索引（PostgreSQL）
CREATE INDEX idx_messages_content_fts ON messages 
    USING gin(to_tsvector('simple', content->>'text'));
```

---

## 五、API设计

### 5.1 API规范

| 规范 | 说明 |
|-----|------|
| RESTful | 遵循REST架构风格 |
| 版本控制 | URL路径版本 `/api/v1/` |
| 认证 | JWT Bearer Token |
| 响应格式 | JSON，统一结构 |
| 错误处理 | HTTP状态码 + 错误详情 |
| 分页 | `page` + `limit` 参数 |
| 过滤 | Query参数过滤 |

### 5.2 统一响应格式

```python
# app/schemas/base.py
from pydantic import BaseModel
from typing import Optional, Any

class BaseResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None
    error: Optional[ErrorDetail] = None

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None

class PaginatedResponse(BaseModel):
    success: bool = True
    data: list
    total: int
    page: int
    limit: int
    has_more: bool
```

### 5.3 API路由示例

```python
# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1 import chat, sessions, files, agents, knowledge, auth, users

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])

# app/api/v1/sessions.py
from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.session_service import SessionService
from app.schemas.session import SessionCreate, SessionUpdate, SessionResponse
from app.schemas.base import PaginatedResponse

router = APIRouter()

@router.post("", response_model=SessionResponse)
async def create_session(
    request: SessionCreate,
    current_user: User = Depends(get_current_user),
    service: SessionService = Depends(get_session_service),
):
    """创建会话"""
    return await service.create_session(
        user_id=current_user.id,
        title=request.title,
        system_prompt=request.system_prompt,
    )

@router.get("", response_model=PaginatedResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    archived: bool = Query(False),
    pinned: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    service: SessionService = Depends(get_session_service),
):
    """获取会话列表"""
    return await service.list_sessions(
        user_id=current_user.id,
        page=page,
        limit=limit,
        archived=archived,
        pinned=pinned,
        search=search,
    )

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    service: SessionService = Depends(get_session_service),
):
    """获取会话详情"""
    session = await service.get_session(session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session

@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    request: SessionUpdate,
    current_user: User = Depends(get_current_user),
    service: SessionService = Depends(get_session_service),
):
    """更新会话"""
    return await service.update_session(
        session_id=session_id,
        user_id=current_user.id,
        updates=request.dict(exclude_unset=True),
    )

@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    service: SessionService = Depends(get_session_service),
):
    """删除会话"""
    await service.delete_session(session_id, current_user.id)
    return {"success": True, "message": "会话已删除"}
```

---

## 六、安全设计

### 6.1 认证机制

```python
# app/core/security.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class SecurityManager:
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = "HS256"
        self.access_token_expire = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        self.refresh_token_expire = settings.REFRESH_TOKEN_EXPIRE_DAYS

    def create_access_token(
        self,
        user_id: str,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """创建访问令牌"""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire)
        
        to_encode = {
            "sub": user_id,
            "type": "access",
            "exp": expire,
            "iat": datetime.utcnow(),
        }
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(self, user_id: str) -> str:
        """创建刷新令牌"""
        expire = datetime.utcnow() + timedelta(days=self.refresh_token_expire)
        to_encode = {
            "sub": user_id,
            "type": "refresh",
            "exp": expire,
            "iat": datetime.utcnow(),
        }
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str) -> Optional[dict]:
        """验证令牌"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None

    def hash_password(self, password: str) -> str:
        """密码加密"""
        return pwd_context.hash(password)

    def verify_password(self, password: str, hash: str) -> bool:
        """密码验证"""
        return pwd_context.verify(password, hash)
```

### 6.2 权限控制

```python
# app/core/middleware.py
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 跳过公开路由
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)
        
        # 验证Token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="未认证")
        
        token = auth_header.split(" ")[1]
        payload = security.verify_token(token)
        
        if not payload:
            raise HTTPException(status_code=401, detail="令牌无效")
        
        # 添加用户信息到请求
        request.state.user_id = payload["sub"]
        request.state.user = await user_repo.get_by_id(payload["sub"])
        
        return await call_next(request)

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user_id = request.state.user_id
        
        # 检查速率限制
        key = f"rate_limit:{user_id}:{request.url.path}"
        count = await redis.get(key)
        
        if count and int(count) > RATE_LIMITS.get(request.url.path, 100):
            raise HTTPException(status_code=429, detail="请求过于频繁")
        
        await redis.incr(key)
        await redis.expire(key, 60)  # 1分钟窗口
        
        return await call_next(request)
```

### 6.3 内容安全审核

```python
# app/services/content_filter.py
from typing import Optional
from app.llm.router import LLMRouter

class ContentFilter:
    def __init__(self, llm_router: LLMRouter):
        self.llm_router = llm_router
        self.sensitive_words = load_sensitive_words()

    async def check_input(self, content: str) -> FilterResult:
        """输入内容审核"""
        # 1. 敏感词检测
        for word in self.sensitive_words:
            if word in content.lower():
                return FilterResult(
                    safe=False,
                    reason=f"包含敏感词: {word}",
                    action="reject",
                )
        
        # 2. AI审核（可选）
        if settings.ENABLE_AI_FILTER:
            result = await self.llm_router.chat(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "判断内容是否包含违规信息"},
                    {"role": "user", "content": content},
                ],
                max_tokens=10,
            )
            if "违规" in result.content:
                return FilterResult(
                    safe=False,
                    reason="AI审核判定违规",
                    action="reject",
                )
        
        return FilterResult(safe=True)

    async def check_output(self, content: str) -> FilterResult:
        """输出内容审核"""
        # 类似输入审核逻辑
        return await self.check_input(content)
```

---

## 七、性能优化

### 7.1 缓存策略

```python
# app/core/cache.py
from redis import asyncio as aioredis
from typing import Optional, Any
import json

class CacheManager:
    def __init__(self, redis_url: str):
        self.redis = aioredis.from_url(redis_url)
        
    async def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        value = await self.redis.get(key)
        if value:
            return json.loads(value)
        return None
    
    async def set(
        self,
        key: str,
        value: Any,
        expire: int = 3600,
    ):
        """设置缓存"""
        await self.redis.set(
            key,
            json.dumps(value),
            ex=expire,
        )
    
    async def delete(self, key: str):
        """删除缓存"""
        await self.redis.delete(key)
    
    async def get_or_set(
        self,
        key: str,
        getter: callable,
        expire: int = 3600,
    ) -> Any:
        """获取或设置缓存"""
        cached = await self.get(key)
        if cached:
            return cached
        
        value = await getter()
        await self.set(key, value, expire)
        return value

# 缓存使用示例
@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    cache: CacheManager = Depends(get_cache),
):
    return await cache.get_or_set(
        f"session:{session_id}",
        lambda: session_repo.get_by_id(session_id),
        expire=300,  # 5分钟
    )
```

### 7.2 数据库优化

```python
# app/repositories/base.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

class BaseRepository:
    def __init__(self, db: AsyncSession, model):
        self.db = db
        self.model = model

    async def get_by_id(self, id: str) -> Optional[Model]:
        """根据ID获取"""
        query = select(self.model).where(self.model.id == id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_paginated(
        self,
        page: int = 1,
        limit: int = 20,
        filters: dict = None,
        order_by: str = None,
    ) -> tuple[List[Model], int]:
        """分页查询"""
        query = select(self.model)
        
        # 过滤条件
        if filters:
            for key, value in filters.items():
                query = query.where(self.model[key] == value)
        
        # 排序
        if order_by:
            query = query.order_by(self.model[order_by])
        
        # 总数
        count_query = select(func.count()).select_from(query)
        total = await self.db.scalar(count_query)
        
        # 分页
        query = query.offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        items = result.scalars().all()
        
        return items, total
```

### 7.3 异步任务

```python
# app/workers/celery_app.py
from celery import Celery

celery_app = Celery(
    "ai_chat",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1小时超时
)

# app/workers/tasks.py
from app.workers.celery_app import celery_app
from app.services.file_service import FileService

@celery_app.task(bind=True)
def process_file_task(self, file_id: str):
    """文件处理任务"""
    file_service = get_file_service()
    
    # 更新进度
    self.update_state(state="PROCESSING", meta={"progress": 0})
    
    try:
        # 处理文件
        result = file_service.process_file(file_id)
        
        self.update_state(state="SUCCESS", meta={"result": result})
        return result
    except Exception as e:
        self.update_state(state="FAILURE", meta={"error": str(e)})
        raise

@celery_app.task
def scheduled_report_task(user_id: str):
    """定时报告任务"""
    # 生成报告逻辑
    pass
```

---

## 八、部署配置

### 8.1 Docker配置

```dockerfile
# Dockerfile
FROM python:3.12-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini .

# 运行迁移
RUN alembic upgrade head

# 启动应用
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/chat
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - db
      - redis
    volumes:
      - ./data:/data

  db:
    image: postgres:16
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=chat
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  worker:
    build: .
    command: celery -A app.workers.celery_app worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/chat
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
  redis_data:
```

### 8.2 Kubernetes配置

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-chat-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-chat-backend
  template:
    metadata:
      labels:
        app: ai-chat-backend
    spec:
      containers:
      - name: api
        image: ai-chat-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        resources:
          requests:
            cpu: "200m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## 九、监控与日志

### 9.1 日志配置

```python
# app/core/logging.py
from loguru import logger
import sys

def setup_logging():
    logger.remove()
    
    # 控制台日志
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
               "<level>{message}</level>",
        level="INFO",
    )
    
    # 文件日志
    logger.add(
        "logs/app_{time:YYYY-MM-DD}.log",
        rotation="00:00",
        retention="30 days",
        compression="zip",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} | {message}",
        level="DEBUG",
    )
    
    # 错误日志单独记录
    logger.add(
        "logs/error_{time:YYYY-MM-DD}.log",
        rotation="00:00",
        retention="90 days",
        level="ERROR",
    )
```

### 9.2 性能监控

```python
# app/core/metrics.py
from prometheus_client import Counter, Histogram, Gauge
from prometheus_fastapi_instrumentator import Instrumentator

# 自定义指标
REQUEST_COUNT = Counter(
    "chat_request_count",
    "Chat API请求计数",
    ["method", "endpoint", "status"],
)

RESPONSE_TIME = Histogram(
    "chat_response_time",
    "Chat API响应时间",
    ["method", "endpoint"],
    buckets=[0.1, 0.5, 1, 2, 5, 10],
)

ACTIVE_SESSIONS = Gauge(
    "active_sessions",
    "活跃会话数量",
)

LLM_CALL_COUNT = Counter(
    "llm_call_count",
    "LLM调用计数",
    ["model", "provider"],
)

LLM_TOKENS = Counter(
    "llm_tokens_total",
    "LLM Token使用总量",
    ["model", "type"],
)

# 初始化监控
def setup_metrics(app):
    Instrumentator().instrument(app).expose(app)
```

---

**技术方案版本历史**

| 版本 | 日期 | 变更说明 |
|-----|------|---------|
| v1.0 | 2026-04-03 | 初始版本，完整后端技术方案 |