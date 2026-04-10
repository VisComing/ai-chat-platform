# Vercel 部署方案

## 架构分析

本项目是 Next.js + FastAPI 分离架构，Vercel 不原生支持 Python 后端，需要分离部署：

| 组件 | 部署平台 | 说明 |
|------|---------|------|
| 前端 | Vercel | Next.js 原生支持 |
| 后端 | Railway / Render | Python + WebSocket 支持 |
| 数据库 | Supabase / Neon | PostgreSQL 云服务 |
| 任务队列 | Redis | Railway Redis 或 Upstash |

## 部署架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户请求                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (前端 Next.js)                         │
│  - 静态页面渲染                                                  │
│  - API Routes (可选，用于代理)                                   │
│  - 域名: your-app.vercel.app                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Railway/Render (后端 FastAPI)                       │
│  - REST API                                                     │
│  - WebSocket (语音识别)                                          │
│  - SSE 流式响应                                                  │
│  - Huey 任务队列                                                │
│  - 域名: your-api.railway.app                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase/Neon (数据库)                        │
│  - PostgreSQL                                                   │
│  - 持久化存储                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 一、前端部署 (Vercel)

### 1.1 环境变量配置

在 Vercel Dashboard 设置以下环境变量：

```env
# API 地址 - 后端部署后的地址
NEXT_PUBLIC_API_URL=https://your-api.railway.app/api/v1

# 测试模式 (生产环境关闭)
NEXT_PUBLIC_TEST_MODE=false

# AI 服务密钥 (可选，如果前端需要)
BAILIAN_API_KEY=your_bailian_key
```

### 1.2 修改 next.config.ts

移除本地开发用的 rewrite，改为直接调用远程 API：

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // 生产环境移除 rewrite，直接使用 NEXT_PUBLIC_API_URL
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
```

### 1.3 WebSocket 适配

`VoiceInput.tsx` 中 WebSocket URL 硬编码为 localhost，需要修改为动态获取：

```typescript
// 从环境变量获取 WebSocket 地址
const wsBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://') || 'ws://localhost:8000/api/v1'
const wsUrl = `${wsBaseUrl}/speech/stream`
```

### 1.4 部署步骤

1. 连接 GitHub 仓库到 Vercel
2. Root Directory 设置为 `frontend`
3. Build Command: `npm run build`
4. Output Directory: `.next`
5. 设置环境变量
6. Deploy

---

## 二、后端部署 (Railway 推荐)

### 2.1 数据库准备

**选项 A: Supabase (推荐)**
- 免费 500MB PostgreSQL
- 自动备份
- 内置认证服务

**选项 B: Neon**
- 免费 512MB PostgreSQL
- 分支功能支持

**选项 C: Railway PostgreSQL**
- 与后端同平台部署
- 统一管理

### 2.2 环境变量配置

```env
# 数据库 (使用 Supabase/Neon 连接字符串)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Redis (Railway Redis 或 Upstash)
REDIS_URL=redis://user:pass@host:6379
HUEY_SQLITE_PATH=/tmp/huey.db  # Railway 使用临时目录

# 安全密钥 (必须修改)
SECRET_KEY=your_production_secret_key_32_chars
JWT_SECRET_KEY=your_jwt_secret_key_32_chars

# CORS (允许前端域名)
CORS_ORIGINS=["https://your-app.vercel.app"]

# AI 服务密钥
BAILIAN_API_KEY=your_bailian_key
ALIBABA_SEARCH_API_KEY=your_search_key

# 文件存储 (使用 Railway 持久化卷)
UPLOAD_DIR=/data/uploads
RESEARCH_REPORT_DIR=/data/uploads/research

# 沙箱配置 (Railway 不支持 Docker，需关闭)
SANDBOX_ENABLED=false

# 语音识别
DOUBAO_ASR_APPID=your_appid
DOUBAO_ASR_TOKEN=your_token
DOUBAO_ASR_SECRET_KEY=your_secret
```

### 2.3 Railway 部署步骤

1. 创建 Railway 项目
2. 添加 PostgreSQL 服务 (或使用外部数据库)
3. 添加 Redis 服务
4. 部署后端服务：
   - Root Directory: `backend`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - 添加持久化卷挂载到 `/data`
5. 配置环境变量
6. 获取生成的域名，配置到前端环境变量

### 2.4 Render 部署 (备选)

Render 支持 Python 部署：
- Web Service 类型
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

## 三、数据库迁移

### 3.1 初始化脚本

需要修改 `backend/app/core/database.py` 确保异步 PostgreSQL 连接正确：

```python
# database.py 需要支持 PostgreSQL 异步连接
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# DATABASE_URL 格式转换
# postgresql:// → postgresql+asyncpg://
database_url = settings.database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
```

### 3.2 Alembic 迁移

部署后首次运行迁移：

```bash
alembic upgrade head
```

Railway 可通过启动命令自动执行：

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

---

## 四、文件存储方案

本地 `./uploads` 目录在 Vercel/Railway 无法持久化，需要外部存储：

**选项 A: Railway 持久化卷**
- 挂载 `/data` 目录
- 适合文件量小的场景

**选项 B: Supabase Storage**
- 与数据库同平台
- 兼容 S3 API

**选项 C: AWS S3 / Cloudflare R2**
- 专业对象存储
- 需修改 `files` 服务代码

---

## 五、WebSocket 限制处理

### 5.1 Vercel WebSocket 限制

Vercel Serverless Functions 不支持 WebSocket 长连接。语音识别功能需要：

**方案 A: 前端直连后端 WebSocket**
- 最简单方案
- 需确保 CORS 配置正确

**方案 B: 使用 WebSocket 代理服务**
- Ably / Pusher / Socket.io Cloud

### 5.2 Railway WebSocket

Railway 完全支持 WebSocket，语音识别可正常工作。

---

## 六、任务队列处理

### 6.1 Huey 配置调整

Huey 默认使用 SQLite，在 Railway 需改为 Redis：

```python
# backend/app/core/config.py
huey_redis_url: str = ""  # 新增配置

# backend/app/services/task_queue.py
from huey import RedisHuey

if settings.huey_redis_url:
    huey = RedisHuey(url=settings.huey_redis_url)
else:
    huey = SqliteHuey(settings.huey_sqlite_path)
```

### 6.2 Worker 进程

Railway 需要单独部署 Worker 服务：

```bash
# Worker 启动命令
python -m huey_consumer backend.app.services.task_queue.huey
```

或使用 Railway 的 Procfile：

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
worker: python -m huey_consumer app.services.task_queue.huey
```

---

## 七、部署检查清单

### 前端 (Vercel)
- [ ] 设置 `NEXT_PUBLIC_API_URL`
- [ ] 移除本地 rewrite 配置
- [ ] 修改 WebSocket URL 动态获取
- [ ] 关闭测试模式
- [ ] 验证 API 连通性

### 后端 (Railway)
- [ ] PostgreSQL 数据库连接
- [ ] Redis 连接配置
- [ ] CORS 配置前端域名
- [ ] 安全密钥已修改
- [ ] Alembic 迁移执行
- [ ] 文件存储卷挂载
- [ ] Worker 进程启动
- [ ] 沙箱功能关闭

### 数据库
- [ ] PostgreSQL 连接字符串正确
- [ ] SSL 模式启用
- [ ] 数据库迁移完成
- [ ] 测试用户创建 (可选)

---

## 八、预计成本

| 服务 | 免费额度 | 超出后成本 |
|------|---------|-----------|
| Vercel | Hobby: 无限 | Pro: $20/月 |
| Railway | $5/月试用金 | 按使用计费 |
| Supabase | 500MB 数据库 | Pro: $25/月 |
| Upstash Redis | 10GB 免费 | 按使用计费 |

**月成本预估**: 开发阶段约 $0-5/月，生产阶段约 $20-50/月

---

## 九、备选方案

如果希望简化部署，可考虑全栈平台：

| 平台 | 优势 | 劣势 |
|------|------|------|
| Railway | 前后端统一部署 | 无 Next.js 原生优化 |
| Render | 支持 Python/Node | 构建速度较慢 |
| Fly.io | 全球边缘部署 | 配置较复杂 |
| 自建 VPS | 完全控制 | 运维成本高 |

---

## 下一步行动

1. 选择数据库服务 (推荐 Supabase)
2. 部署后端到 Railway
3. 配置环境变量并测试后端 API
4. 部署前端到 Vercel
5. 配置前端环境变量指向后端
6. E2E 测试验证完整流程