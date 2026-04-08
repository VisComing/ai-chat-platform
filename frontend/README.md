# AI Chat Frontend

> AI对话平台前端 - Next.js 15 + React 19 + TypeScript

## 技术栈

- **框架**: Next.js 15 (App Router)
- **UI**: React 19 + TypeScript + Tailwind CSS
- **状态管理**: Zustand + React Query
- **组件库**: Radix UI + 自定义组件
- **测试**: Jest + Playwright

## 快速开始

### 环境要求

- Node.js 20+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 根布局
│   ├── page.tsx            # 首页
│   └── globals.css         # 全局样式
├── components/             # 组件库
│   ├── ui/                 # 基础UI组件
│   ├── chat/               # 对话组件
│   └── layout/             # 布局组件
├── hooks/                  # 自定义Hooks
├── stores/                 # Zustand状态管理
├── services/              # API服务
├── types/                  # TypeScript类型
├── lib/                    # 工具函数
└── tests/                  # 测试文件
```

## 测试

### 单元测试

```bash
npm run test
```

### E2E测试

```bash
npm run test:e2e
```

## 环境变量

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## License

MIT
