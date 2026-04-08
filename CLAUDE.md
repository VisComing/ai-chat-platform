# CLAUDE.md 遵守规范

## 工作方式
- 在实现前先说明方法。
- 若需求有歧义、风险较高或影响较大，先澄清并等待批准，再开始写代码。
- Plan 只写方案，不写代码。
- 坚持 Spec Coding，不做 Vibe Coding。
- 优先迭代，使用 `/loop`。
- 完成后执行 `/simplify`。

## 编码规则
- Spec 不依赖行号定位代码。
- 注释中不要写开发过程式说明。
- 优先用概念性描述定位代码，不用“文件路径 + 行号”。

## 拆分与范围控制
- 将任务拆分为低耦合、可独立验证的子任务，必要时使用 `/batch`。
- 重复出现 3 次的流程应沉淀为 Skill。


## 质量要求
- 项目早期只保留最小必要质量标准：可运行、可验证、可回滚。
- 优先保证关键路径和高风险改动可验证。
- 处理 bug 时，先复现，再修复并验证。

## 纠错与协作
- 被纠正时，识别原因并改进做法；对重复性问题，沉淀为明确规则。
- 实现与审查分离：先完成方案或代码，再独立复核。


## 禁止事项
- `CLAUDE.md` 应按项目实际需求编写，不要套用空泛模板。
- Avoid terms to describe development progress (`FIXED`, `Step`, `Week`, `Section`, `Phase`, `AC-x`, etc) in code comments or commit message or PR body.
- Avoid AI tools name (like Codex, Claude, Grok, Gemini, ...) in code comments or git commit message (including authorship) or PR body.

## 其余事项
- 联网搜索优先使用websearch MCP

# AI对话平台 - Claude Code 项目指南

## 项目概述

这是一个基于 Next.js + Python 的智能对话交互平台，支持多模态输入输出、Agent任务执行、联网搜索等核心能力。

## 项目结构

```
ai-chat-platform/
├── frontend/                 # 前端代码
│   ├── app/                  # Next.js App Router
│   ├── components/           # React组件
│   │   ├── chat/             # 对话相关组件
│   │   ├── layout/           # 布局组件
│   │   └── ui/               # UI基础组件
│   ├── services/             # API服务层
│   ├── stores/               # Zustand状态管理
│   └── lib/                  # 工具函数
│
├── backend/                  # 后端代码
│   ├── app/
│   │   ├── api/v1/           # API路由 (auth, chat, sessions, users, files)
│   │   ├── core/             # 核心配置 (config, database, security)
│   │   ├── models/           # SQLAlchemy模型
│   │   ├── schemas/          # Pydantic schemas
│   │   └ services/           # 业务服务层
│   │   │   ├── ai_service.py      # AI对话服务
│   │   │   ├── agent_service.py   # LangGraph Agent服务
│   │   │   └ search_service.py    # 联网搜索服务
│   ├── tests/                # 测试文件
│   └ requirements.txt        # Python依赖
│
├── docs/                     # 文档
│
├── design/                   # 设计文档
│   └ UI-Design-System.md     # UI设计系统
```

## 核心API端点

### 后端API (FastAPI)
- `/api/v1/auth` - 认证 (注册、登录、刷新Token)
- `/api/v1/sessions` - 会话管理 (CRUD、置顶、归档)
- `/api/v1/chat/stream` - 普通对话 SSE流式接口
- `/api/v1/chat/agent/stream` - Agent对话 SSE流式接口 (带联网搜索)
- `/api/v1/files` - 文件上传/下载
- `/health` - 健康检查

## 开发指南

### 前端启动
```bash
cd frontend
npm install
npm run dev  # http://localhost:3000
```

### 后端启动
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # http://localhost:8000
```

## 代码风格约定

### 前端
- 使用 TypeScript 严格模式
- 组件使用函数式组件 + hooks
- 状态管理使用 Zustand
- API调用使用 services/ 层封装
- UI组件遵循 shadcn/ui 风格

### 后端
- 使用 async/await 异步模式
- API路由使用 FastAPI 路由器
- 数据验证使用 Pydantic
- 服务层分离业务逻辑
- 错误使用统一响应格式: `{success, error: {code, message}}`