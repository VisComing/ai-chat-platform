# AI Chat Backend

> AI对话平台后端 - Python 3.12 + FastAPI

## 技术栈

- **框架**: FastAPI 0.115 + Python 3.12
- **数据库**: SQLAlchemy 2.0 + SQLite/PostgreSQL
- **认证**: JWT (python-jose)
- **任务队列**: Celery
- **测试**: pytest + pytest-asyncio

## 快速开始

### 环境要求

- Python 3.12+
- Redis (可选)

### 安装依赖

```bash
pip install -r requirements.txt
```

### 开发模式

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看API文档

### Docker 运行

```bash
docker-compose up backend
```

## 项目结构

```
backend/
├── app/
│   ├── main.py              # FastAPI入口
│   ├── api/                 # API路由
│   │   └── v1/              # API v1版本
│   ├── core/                # 核心模块
│   │   ├── config.py        # 配置
│   │   ├── database.py      # 数据库
│   │   └── security.py      # 安全认证
│   ├── models/              # 数据模型
│   ├── schemas/             # Pydantic模型
│   ├── services/            # 业务服务
│   ├── llm/                 # LLM集成
│   ├── workers/             # 异步任务
│   └── utils/               # 工具函数
├── tests/                   # 测试文件
├── migrations/              # 数据库迁移
└── scripts/                 # 脚本
```

## API 端点

### 认证
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新Token
- `GET /api/v1/auth/me` - 获取当前用户

### 会话
- `GET /api/v1/sessions` - 获取会话列表
- `POST /api/v1/sessions` - 创建会话
- `GET /api/v1/sessions/{id}` - 获取会话
- `PATCH /api/v1/sessions/{id}` - 更新会话
- `DELETE /api/v1/sessions/{id}` - 删除会话

### 对话
- `POST /api/v1/chat/stream` - 流式对话 (SSE)

### 文件
- `POST /api/v1/files/upload` - 上传文件
- `GET /api/v1/files/{id}` - 获取文件信息
- `GET /api/v1/files/{id}/download` - 下载文件
- `DELETE /api/v1/files/{id}` - 删除文件

## 测试

### 运行测试

```bash
# 单元测试
pytest tests/unit/ -v

# 集成测试
pytest tests/integration/ -v

# 所有测试
pytest tests/ -v --cov=app
```

## 环境变量

```env
DATABASE_URL=sqlite+aiosqlite:///./chat.db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## License

MIT
