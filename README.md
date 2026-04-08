# AI对话平台

> 基于Next.js + Python的智能对话交互平台

## 项目概述

AI对话平台是一个面向企业和个人用户的智能对话交互平台，支持多模态输入输出、Agent任务执行、知识库问答等核心能力。

### 核心特性

- **多轮对话**: 支持连续上下文理解的智能对话
- **流式输出**: SSE协议实现逐字渲染，低延迟响应
- **多模态交互**: 图片、文件、语音、视频理解与分析
- **Agent能力**: 多步骤任务规划与执行
- **知识库问答**: RAG技术实现私有文档精准问答
- **联网搜索**: 实时搜索最新信息并溯源展示

### 技术栈

| 层级 | 技术 |
|-----|------|
| 前端 | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| 后端 | Python 3.12 + FastAPI + SQLAlchemy |
| 数据库 | PostgreSQL 16 + Redis 7 + Milvus |
| AI服务 | OpenAI / Anthropic / 本地模型 |
| 部署 | Docker + Kubernetes |

---

## 项目状态

### 已完成的功能

#### 前端 (Next.js)
- [x] 项目初始化和配置
- [x] UI基础组件库（Button、Input、Card、Avatar、Skeleton、Toast、Modal）
- [x] 对话组件（MessageBubble、MessageList、InputArea、ChatContainer）
- [x] 布局组件（Sidebar、Header）
- [x] 状态管理（chatStore、sessionStore）
- [x] API服务层（apiClient、chatService、sessionService、authService）
- [x] 主题切换（亮色/暗色/系统）
- [x] 单元测试和E2E测试配置

#### 后端 (FastAPI)
- [x] 项目初始化和配置
- [x] 数据库模型（User、Session、Message、File）
- [x] Pydantic schemas
- [x] 认证API（注册、登录、刷新Token）
- [x] 会话API（CRUD、置顶、归档）
- [x] 对话API（SSE流式响应）
- [x] 文件API（上传、下载、删除）
- [x] JWT安全认证
- [x] 单元测试和集成测试

#### DevOps
- [x] Docker配置
- [x] docker-compose配置
- [x] GitHub Actions CI/CD配置

### 快速开始

#### 前端

```bash
cd frontend
npm install
npm run dev
```

#### 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Docker

```bash
docker-compose up
```

## 文档目录

### 产品文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| PRD产品需求文档 | [docs/PRD.md](docs/PRD.md) | 产品定位、功能需求、用户故事、路线图 |

### 设计文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| UI设计系统 | [design/UI-Design-System.md](design/UI-Design-System.md) | 色彩、字体、间距、组件库、响应式设计 |

### 技术文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 前端技术方案 | [tech/Frontend-Tech-Solution.md](tech/Frontend-Tech-Solution.md) | Next.js架构、核心模块、性能优化 |
| 后端技术方案 | [tech/Backend-Tech-Solution.md](tech/Backend-Tech-Solution.md) | FastAPI架构、LLM集成、RAG模块 |
| 架构与部署方案 | [tech/Architecture-and-Deployment.md](tech/Architecture-and-Deployment.md) | 系统架构、部署方案、CI/CD流程 |

---

## 快速开始

### 环境要求

- Node.js 20+
- Python 3.12+
- PostgreSQL 16+
- Redis 7+

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

### 后端启动

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Docker启动

```bash
docker-compose up -d
```

---

## 项目结构

```
ai-chat-platform/
├── docs/                    # 产品文档
│   └── PRD.md               # 产品需求文档
│
├── design/                  # 设计文档
│   └ UI-Design-System.md    # UI设计系统
│
├── tech/                    # 技术文档
│   ├── Frontend-Tech-Solution.md    # 前端技术方案
│   ├── Backend-Tech-Solution.md     # 后端技术方案
│   └ Architecture-and-Deployment.md # 架构与部署方案
│
├── frontend/                # 前端代码（待开发）
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── ...
│
├── backend/                 # 后端代码（待开发）
│   ├── app/
│   ├── migrations/
│   ├── tests/
│   └── ...
│
└ README.md                  # 项目说明
```

---

## 开发路线图

### Phase 1: MVP (4周)
- 基础对话功能
- 流式输出
- 会话管理
- 用户认证

### Phase 2: 增强版 (6周)
- 图片理解
- 文件上传与解析
- 联网搜索
- 代码执行
- 知识库问答

### Phase 3: 专业版 (8周)
- Agent任务执行
- 多Agent协作
- 定时任务
- 插件系统
- API开放平台

---

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

---

## 许可证

MIT License

---

**版本**: v1.0  
**日期**: 2026-04-03  
**团队**: 产品设计开发团队