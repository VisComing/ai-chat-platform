# AI对话平台前端技术方案

**版本**: v1.0  
**日期**: 2026-04-03  
**技术栈**: Next.js 15 + React 19 + TypeScript  
**负责人**: 前端技术团队

---

## 一、技术选型

### 1.1 核心框架

| 技术 | 版本 | 选型理由 |
|-----|------|---------|
| Next.js | 15.x | SSR/SSG支持、App Router、性能优化 |
| React | 19.x | 最新特性、并发渲染、Suspense |
| TypeScript | 5.x | 类型安全、开发体验、代码质量 |
| Tailwind CSS | 4.x | 原子化CSS、设计Token集成、性能 |
| Zustand | 5.x | 轻量状态管理、简洁API |
| React Query | 5.x | 服务端状态管理、缓存、同步 |
| Socket.io-client | 4.x | WebSocket通信、实时更新 |

### 1.2 辅助库

| 库名 | 用途 |
|-----|------|
| react-markdown | Markdown渲染 |
| remark-gfm | GitHub风格Markdown |
| rehype-highlight | 代码高亮 |
| katex | LaTeX数学公式 |
| react-hook-form | 表单管理 |
| zod | 数据验证 |
| date-fns | 日期处理 |
| lucide-react | 图标库 |
| framer-motion | 动画库 |
| react-virtualized | 虚拟滚动 |

### 1.3 开发工具

| 工具 | 用途 |
|-----|------|
| ESLint | 代码检查 |
| Prettier | 代码格式化 |
| Husky | Git钩子 |
| lint-staged | 暂存区检查 |
| Jest | 单元测试 |
| Playwright | E2E测试 |
| Storybook | 组件文档 |

---

## 二、项目架构

### 2.1 目录结构

```
ai-chat-platform/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 认证路由组
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   ├── (chat)/                   # 对话路由组
│   │   ├── page.tsx              # 首页/对话页
│   │   ├── sessions/[id]/        # 会话详情
│   │   ├── agents/               # 智能体页面
│   │   ├── knowledge/            # 知识库页面
│   │   └── layout.tsx
│   ├── (settings)/               # 设置路由组
│   │   ├── profile/
│   │   ├── preferences/
│   │   └── layout.tsx
│   ├── api/                      # API路由
│   │   ├── chat/
│   │   ├── sessions/
│   │   ├── files/
│   │   ├── agents/
│   │   └── auth/
│   ├── layout.tsx                # 根布局
│   ├── globals.css               # 全局样式
│   ├── not-found.tsx             # 404页面
│   └── error.tsx                 # 错误页面
│
├── components/                   # 组件库
│   ├── ui/                       # 基础UI组件
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Card/
│   │   ├── Modal/
│   │   ├── Toast/
│   │   ├── Dropdown/
│   │   ├── Skeleton/
│   │   └── index.ts
│   ├── chat/                     # 对话组件
│   │   ├── ChatContainer/
│   │   ├── MessageBubble/
│   │   ├── MessageList/
│   │   ├── InputArea/
│   │   ├── CodeBlock/
│   │   ├── ThinkingBlock/
│   │   ├── FilePreview/
│   │   └── ImagePreview/
│   ├── layout/                   # 布局组件
│   │   ├── Sidebar/
│   │   ├── Header/
│   │   ├── Footer/
│   │   ├── MobileNav/
│   │   └── Container/
│   ├── features/                 # 功能组件
│   │   ├── SessionList/
│   │   ├── AgentList/
│   │   ├── KnowledgePanel/
│   │   ├── ModelSelector/
│   │   ├── ThemeToggle/
│   │   └── SearchBar/
│   └── shared/                   # 共享组件
│       ├── Avatar/
│       ├── Icon/
│       ├── Loading/
│       ├── ErrorBoundary/
│       └── EmptyState/
│
├── hooks/                        # 自定义Hooks
│   ├── useChat.ts                # 对话逻辑
│   ├── useSession.ts             # 会话管理
│   ├── useStreaming.ts           # 流式输出
│   ├── useFileUpload.ts          # 文件上传
│   ├── useTheme.ts               # 主题切换
│   ├── useKeyboard.ts            # 快捷键
│   ├── useScroll.ts              # 滚动控制
│   ├── useDebounce.ts            # 防抖
│   └── useLocalStorage.ts        # 本地存储
│
├── stores/                       # 状态管理
│   ├── chatStore.ts              # 对话状态
│   ├── sessionStore.ts           # 会话状态
│   ├── userStore.ts              # 用户状态
│   ├── settingsStore.ts          # 设置状态
│   ├── uiStore.ts                # UI状态
│   └── agentStore.ts             # Agent状态
│
├── services/                     # API服务
│   ├── apiClient.ts              # API客户端
│   ├── chatService.ts            # 对话服务
│   ├── sessionService.ts         # 会话服务
│   ├── fileService.ts            # 文件服务
│   ├── authService.ts            # 认证服务
│   ├── agentService.ts           # Agent服务
│   ├── knowledgeService.ts       # 知识库服务
│   └── searchService.ts          # 搜索服务
│
├── types/                        # 类型定义
│   ├── chat.ts                   # 对话类型
│   ├── session.ts                # 会话类型
│   ├── user.ts                   # 用户类型
│   ├── message.ts                # 消息类型
│   ├── agent.ts                  # Agent类型
│   ├── file.ts                   # 文件类型
│   ├── api.ts                    # API类型
│   └── index.ts                  # 类型导出
│
├── utils/                        # 工具函数
│   ├── format.ts                 # 格式化
│   ├── validation.ts             # 验证
│   ├── storage.ts                # 存储
│   ├── crypto.ts                 # 加密
│   ├── date.ts                   # 日期处理
│   ├── url.ts                    # URL处理
│   ├── markdown.ts               # Markdown处理
│   └── constants.ts              # 常量定义
│
├── lib/                          # 第三方库配置
│   ├── axios.ts                  # Axios配置
│   ├── socket.ts                 # Socket配置
│   ├── markdown.ts               # Markdown渲染配置
│   └── analytics.ts              # 分析配置
│
├── styles/                       # 样式文件
│   ├── tokens.css                # 设计Token
│   ├── globals.css               # 全局样式
│   ├── animations.css            # 动画样式
│   └── themes/                   # 主题样式
│       ├── light.css
│       └── dark.css
│
├── public/                       # 静态资源
│   ├── icons/
│   ├── images/
│   ├── fonts/
│   └── favicon.ico
│
├── tests/                        # 测试文件
│   ├── unit/
│   ├── e2e/
│   └── mocks/
│
├── docs/                         # 文档
│   ├── components/
│   ├── hooks/
│   └── api/
│
├── .storybook/                   # Storybook配置
│
├── next.config.ts                # Next.js配置
├── tailwind.config.ts            # Tailwind配置
├── tsconfig.json                 # TypeScript配置
├── package.json                  # 项目依赖
└── README.md                     # 项目说明
```

### 2.2 路由设计

```typescript
// 路由配置
const routes = {
  // 公开路由
  public: {
    home: '/',
    login: '/login',
    register: '/register',
  },
  
  // 认证路由
  auth: {
    chat: '/chat',
    sessions: '/sessions',
    sessionDetail: '/sessions/:id',
    agents: '/agents',
    agentDetail: '/agents/:id',
    knowledge: '/knowledge',
    knowledgeDetail: '/knowledge/:id',
    settings: '/settings',
    profile: '/settings/profile',
    preferences: '/settings/preferences',
  },
  
  // API路由
  api: {
    chat: '/api/chat',
    chatStream: '/api/chat/stream',
    sessions: '/api/sessions',
    sessionDetail: '/api/sessions/:id',
    files: '/api/files',
    agents: '/api/agents',
    knowledge: '/api/knowledge',
    auth: '/api/auth',
    search: '/api/search',
  }
};
```

---

## 三、核心模块设计

### 3.1 对话模块

#### 3.1.1 数据流架构

```
用户输入 → InputArea组件
    ↓
useChat Hook处理
    ↓
chatService发送请求（SSE流）
    ↓
useStreaming Hook接收流式数据
    ↓
chatStore更新消息状态
    ↓
MessageList组件渲染更新
    ↓
MessageBubble显示消息
```

#### 3.1.2 核心类型定义

```typescript
// types/message.ts
interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;
  status: MessageStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: MessageMetadata;
}

type MessageContent = 
  | TextContent
  | ImageContent
  | FileContent
  | CodeContent
  | MixedContent;

interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface FileContent {
  type: 'file';
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

interface CodeContent {
  type: 'code';
  language: string;
  code: string;
  output?: string;
}

interface MixedContent {
  type: 'mixed';
  parts: MessageContent[];
}

type MessageStatus = 
  | 'pending'      // 发送中
  | 'streaming'    // 流式输出中
  | 'completed'    // 完成
  | 'error'        // 错误
  | 'cancelled';   // 取消

interface MessageMetadata {
  model?: string;
  tokens?: {
    input: number;
    output: number;
  };
  thinking?: string;    // 思考过程
  sources?: Source[];   // 搜索来源
  duration?: number;    // 响应时长
}

interface Source {
  title: string;
  url: string;
  snippet?: string;
}
```

#### 3.1.3 流式输出实现

```typescript
// hooks/useStreaming.ts
import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';

interface StreamingOptions {
  sessionId: string;
  onMessage?: (chunk: string) => void;
  onComplete?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export function useStreaming() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const { addMessage, updateMessage } = useChatStore();

  const startStreaming = useCallback(async (
    sessionId: string,
    content: MessageContent,
    options?: StreamingOptions
  ) => {
    // 创建AbortController用于取消请求
    abortControllerRef.current = new AbortController();

    // 创建临时消息ID
    const tempMessageId = `temp-${Date.now()}`;
    
    // 添加用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addMessage(userMessage);

    // 创建AI消息（初始为空）
    const aiMessage: Message = {
      id: tempMessageId,
      sessionId,
      role: 'assistant',
      content: { type: 'text', text: '' },
      status: 'streaming',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addMessage(aiMessage);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          content,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('无法读取响应');

      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // 解析SSE数据
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'text') {
              accumulatedText += data.content;
              updateMessage(tempMessageId, {
                content: { type: 'text', text: accumulatedText },
                updatedAt: new Date(),
              });
              options?.onMessage?.(data.content);
            } else if (data.type === 'thinking') {
              updateMessage(tempMessageId, {
                metadata: { thinking: data.content },
              });
            } else if (data.type === 'complete') {
              updateMessage(tempMessageId, {
                id: data.messageId,
                status: 'completed',
                metadata: data.metadata,
              });
              options?.onComplete?.(aiMessage);
            } else if (data.type === 'error') {
              updateMessage(tempMessageId, {
                status: 'error',
                content: { type: 'text', text: data.message },
              });
              options?.onError?.(new Error(data.message));
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        updateMessage(tempMessageId, { status: 'cancelled' });
      } else {
        updateMessage(tempMessageId, { status: 'error' });
        options?.onError?.(error as Error);
      }
    }
  }, [addMessage, updateMessage]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { startStreaming, stopStreaming };
}
```

#### 3.1.4 消息渲染组件

```typescript
// components/chat/MessageBubble.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { FilePreview } from './FilePreview';
import { ImagePreview } from './ImagePreview';

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}

export function MessageBubble({ 
  message, 
  onRegenerate, 
  onCopy, 
  onDelete 
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';

  return (
    <div className={cn(
      'flex gap-3 py-4',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* 头像 */}
      <Avatar 
        src={isUser ? user.avatar : '/icons/bot.svg'}
        alt={isUser ? '用户' : 'AI助手'}
        size={32}
      />

      {/* 消息内容 */}
      <div className={cn(
        'flex-1 max-w-[70%]',
        isUser ? 'items-end' : 'items-start'
      )}>
        <div className={cn(
          'rounded-xl px-4 py-3',
          isUser 
            ? 'bg-primary-500 text-white rounded-tr-sm' 
            : 'bg-secondary-100 text-secondary-900 rounded-tl-sm'
        )}>
          {/* 思考过程 */}
          {message.metadata?.thinking && (
            <ThinkingBlock 
              content={message.metadata.thinking}
              collapsed={!isStreaming}
            />
          )}

          {/* 消息内容 */}
          <MessageContentRenderer content={message.content} />

          {/* 流式输出指示器 */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
          )}
        </div>

        {/* 操作按钮 */}
        {!isUser && message.status === 'completed' && (
          <MessageActions 
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onDelete={onDelete}
          />
        )}

        {/* 元信息 */}
        <MessageMeta message={message} />
      </div>
    </div>
  );
}

// 消息内容渲染器
function MessageContentRenderer({ content: MessageContent }) {
  switch (content.type) {
    case 'text':
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            code: ({ node, inline, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <CodeBlock 
                  language={match[1]}
                  code={String(children)}
                />
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content.text}
        </ReactMarkdown>
      );

    case 'image':
      return <ImagePreview url={content.url} alt={content.alt} />;

    case 'file':
      return <FilePreview file={content} />;

    case 'code':
      return <CodeBlock language={content.language} code={content.code} />;

    case 'mixed':
      return (
        <div className="space-y-3">
          {content.parts.map((part, i) => (
            <MessageContentRenderer key={i} content={part} />
          ))}
        </div>
      );

    default:
      return null;
  }
}
```

### 3.2 会话管理模块

#### 3.2.1 会话状态管理

```typescript
// stores/sessionStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  searchQuery: string;
  
  // Actions
  createSession: (title?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => void;
  setActiveSession: (id: string) => void;
  searchSessions: (query: string) => void;
  archiveSession: (id: string) => void;
  pinSession: (id: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      searchQuery: '',

      createSession: async (title) => {
        const session = await sessionService.create({ title });
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
        }));
        return session;
      },

      deleteSession: async (id) => {
        await sessionService.delete(id);
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id 
            ? null 
            : state.activeSessionId,
        }));
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
      },

      searchSessions: (query) => {
        set({ searchQuery: query });
      },

      archiveSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, archived: true } : s
          ),
        }));
      },

      pinSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, pinned: !s.pinned } : s
          ),
        }));
      },
    }),
    {
      name: 'session-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);
```

#### 3.2.2 会话列表组件

```typescript
// components/features/SessionList.tsx
import React, { useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSessionStore } from '@/stores/sessionStore';

export function SessionList() {
  const { sessions, activeSessionId, searchQuery, setActiveSession } = useSessionStore();

  // 过滤和排序
  const filteredSessions = useMemo(() => {
    let result = sessions.filter((s) => !s.archived);
    
    if (searchQuery) {
      result = result.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 置顶优先，然后按时间排序
    return result.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [sessions, searchQuery]);

  // 虚拟滚动
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredSessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <SessionItem
            key={virtualItem.key}
            session={filteredSessions[virtualItem.index]}
            isActive={activeSessionId === filteredSessions[virtualItem.index].id}
            onClick={() => setActiveSession(filteredSessions[virtualItem.index].id)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

### 3.3 文件上传模块

#### 3.3.1 文件上传Hook

```typescript
// hooks/useFileUpload.ts
import { useState, useCallback } from 'react';
import { fileService } from '@/services/fileService';

interface FileUploadOptions {
  maxSize?: number;        // 最大文件大小（字节）
  maxFiles?: number;       // 最大文件数量
  accept?: string[];       // 允许的文件类型
  onProgress?: (progress: number) => void;
  onSuccess?: (file: UploadedFile) => void;
  onError?: (error: Error) => void;
}

export function useFileUpload(options?: FileUploadOptions) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const validateFile = useCallback((file: File): boolean => {
    // 检查文件大小
    if (options?.maxSize && file.size > options.maxSize) {
      throw new Error(`文件大小超过限制 ${options.maxSize / 1024 / 1024}MB`);
    }

    // 检查文件类型
    if (options?.accept) {
      const isAccepted = options.accept.some((type) =>
        file.type.match(type.replace('*', '.*'))
      );
      if (!isAccepted) {
        throw new Error('不支持的文件类型');
      }
    }

    return true;
  }, [options]);

  const upload = useCallback(async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    
    // 检查文件数量
    if (options?.maxFiles && filesArray.length > options.maxFiles) {
      throw new Error(`最多上传 ${options.maxFiles} 个文件`);
    }

    setUploading(true);

    try {
      for (const file of filesArray) {
        validateFile(file);

        const uploadFile: UploadFile = {
          id: `temp-${Date.now()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          progress: 0,
          status: 'uploading',
        };

        setFiles((prev) => [...prev, uploadFile]);

        // 上传文件
        const uploaded = await fileService.upload(file, {
          onProgress: (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id ? { ...f, progress } : f
              )
            );
            options?.onProgress?.(progress);
          },
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id 
              ? { ...f, id: uploaded.id, url: uploaded.url, status: 'completed' }
              : f
          )
        );

        options?.onSuccess?.(uploaded);
      }
    } catch (error) {
      options?.onError?.(error as Error);
    } finally {
      setUploading(false);
    }
  }, [validateFile, options]);

  const remove = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
  }, []);

  return {
    files,
    uploading,
    upload,
    remove,
    clear,
  };
}
```

#### 3.3.2 拖拽上传组件

```typescript
// components/chat/FileUploader.tsx
import React, { useRef, useState } from 'react';
import { useFileUpload } from '@/hooks/useFileUpload';

export function FileUploader({ onUpload }: { onUpload: (files: UploadedFile[]) => void }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { files, upload, remove } = useFileUpload({
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    accept: ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx'],
    onSuccess: (file) => {
      const completedFiles = files.filter(f => f.status === 'completed');
      if (completedFiles.length === files.length) {
        onUpload(completedFiles);
      }
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      upload(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      upload(e.target.files);
    }
  };

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-lg p-4 transition-colors',
        dragActive ? 'border-primary bg-primary-50' : 'border-secondary-300'
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleChange}
        className="hidden"
      />

      <div className="text-center">
        <Icon name="upload" size={32} className="mx-auto text-secondary-400" />
        <p className="text-secondary-600 mt-2">
          拖拽文件到此处，或
          <button
            onClick={() => inputRef.current?.click()}
            className="text-primary hover:underline"
          >
            点击选择文件
          </button>
        </p>
        <p className="text-secondary-400 text-sm mt-1">
          支持图片、PDF、Word、Excel，最大10MB
        </p>
      </div>

      {/* 已上传文件列表 */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <FilePreviewItem
              key={file.id}
              file={file}
              onRemove={() => remove(file.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3.4 Markdown渲染模块

#### 3.4.1 Markdown渲染配置

```typescript
// lib/markdown.ts
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

export const markdownConfig = {
  remarkPlugins: [
    remarkGfm,      // GitHub风格Markdown
    remarkMath,     // 数学公式支持
  ],
  rehypePlugins: [
    rehypeHighlight, // 代码高亮
    rehypeKatex,     // LaTeX渲染
    rehypeRaw,       // 允许HTML
  ],
  components: {
    // 自定义组件映射
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold mb-4">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold mb-3">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-medium mb-2">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="mb-2 leading-relaxed">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="ml-2">{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-secondary-300 pl-4 italic my-2">
        {children}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-secondary-200 px-4 py-2 bg-secondary-50 font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-secondary-200 px-4 py-2">
        {children}
      </td>
    ),
    code: CodeComponent,
    pre: PreComponent,
    img: ImageComponent,
  },
};

// 代码块组件
function CodeComponent({ node, inline, className, children, ...props }) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  if (!inline && language) {
    return <CodeBlock language={language} code={String(children).trim()} />;
  }
  
  return (
    <code 
      className={cn(
        'bg-secondary-100 px-1.5 py-0.5 rounded text-sm font-mono',
        inline && 'text-primary'
      )}
      {...props}
    >
      {children}
    </code>
  );
}

// 图片组件
function ImageComponent({ src, alt }) {
  return (
    <img 
      src={src} 
      alt={alt}
      className="max-w-full rounded-lg my-2"
      loading="lazy"
    />
  );
}
```

---

## 四、性能优化策略

### 4.1 首屏加载优化

| 优化项 | 实现方式 | 预期效果 |
|-----|---------|---------|
| 路由预加载 | `next/link` prefetch | 减少页面切换时间 |
| 组件懒加载 | `next/dynamic` 动态导入 | 减少初始包大小 |
| 图片优化 | `next/image` 自动优化 | 减少图片加载时间 |
| 字体优化 | `next/font` 字体加载 | 防止字体闪烁 |
| 代码分割 | 自动分割 + 手动分割 | 减少首屏JS大小 |

```typescript
// 组件懒加载示例
const KnowledgePanel = dynamic(
  () => import('@/components/features/KnowledgePanel'),
  { 
    loading: () => <Skeleton className="h-96" />,
    ssr: false  // 仅客户端渲染
  }
);

const CodeBlock = dynamic(
  () => import('@/components/chat/CodeBlock'),
  { 
    loading: () => <Skeleton className="h-32" />
  }
);
```

### 4.2 运行时性能优化

| 优化项 | 实现方式 | 预期效果 |
|-----|---------|---------|
| 虚拟滚动 | `@tanstack/react-virtual` | 长列表性能提升 |
| 状态缓存 | `@tanstack/react-query` | 减少重复请求 |
| 消息去重 | 基于ID的消息去重 | 防止重复渲染 |
| 批量更新 | React批量更新机制 | 减少渲染次数 |
| 防抖节流 | `useDebounce` Hook | 减少高频操作 |

```typescript
// 虚拟滚动配置
const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 80, // 预估消息高度
  overscan: 10,           // 预渲染数量
  measureElement: (element) => {
    // 动态测量实际高度
    return element.getBoundingClientRect().height;
  },
});
```

### 4.3 网络优化

| 优化项 | 实现方式 | 预期效果 |
|-----|---------|---------|
| SSE流式传输 | Server-Sent Events | 降低首字延迟 |
| 请求缓存 | React Query缓存 | 减少重复请求 |
| 断点续传 | 文件分片上传 | 大文件上传稳定性 |
| 离线缓存 | Service Worker | 离线可用性 |
| 请求合并 | 批量API请求 | 减少请求次数 |

### 4.4 内存优化

| 优化项 | 实现方式 | 预期效果 |
|-----|---------|---------|
| 消息分页 | 滚动加载历史消息 | 减少内存占用 |
| 图片懒加载 | Intersection Observer | 按需加载图片 |
| 组件卸载 | 清理定时器、订阅 | 防止内存泄漏 |
| 状态清理 | 会话切换清理状态 | 减少状态体积 |

---

## 五、安全策略

### 5.1 XSS防护

```typescript
// utils/sanitize.ts
import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id',
      'target', 'rel',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

// Markdown渲染时应用
<ReactMarkdown
  {...markdownConfig}
  transform={(html) => sanitizeHtml(html)}
>
  {content}
</ReactMarkdown>
```

### 5.2 CSRF防护

```typescript
// lib/axios.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // 发送Cookie
});

// 自动添加CSRF Token
apiClient.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrf-token');
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
```

### 5.3 内容安全策略

```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' data:;
      connect-src 'self' https://api.example.com;
      frame-ancestors 'none';
    `.replace(/\s{2,}/g, ' ').trim(),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
];

export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

## 六、测试策略

### 6.1 单元测试

```typescript
// tests/unit/hooks/useStreaming.test.ts
import { renderHook, act } from '@testing-library/react';
import { useStreaming } from '@/hooks/useStreaming';

describe('useStreaming', () => {
  it('should handle streaming messages', async () => {
    const { result } = renderHook(() => useStreaming());

    await act(async () => {
      await result.current.startStreaming('session-1', {
        type: 'text',
        text: 'Hello',
      });
    });

    expect(result.current.messages.length).toBe(2);
    expect(result.current.messages[1].status).toBe('completed');
  });

  it('should handle streaming cancellation', async () => {
    const { result } = renderHook(() => useStreaming());

    act(() => {
      result.current.startStreaming('session-1', {
        type: 'text',
        text: 'Hello',
      });
      result.current.stopStreaming();
    });

    expect(result.current.messages[1].status).toBe('cancelled');
  });
});
```

### 6.2 E2E测试

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('[type="submit"]');
    await page.waitForURL('/chat');
  });

  test('should send message and receive response', async ({ page }) => {
    await page.fill('[data-testid="chat-input"]', 'Hello AI');
    await page.click('[data-testid="send-button"]');

    // 等待AI响应开始
    await page.waitForSelector('[data-testid="ai-message"]');

    // 验证消息内容
    const aiMessage = await page.textContent('[data-testid="ai-message"]');
    expect(aiMessage).toBeTruthy();
  });

  test('should handle file upload', async ({ page }) => {
    await page.setInputFiles(
      '[data-testid="file-input"]',
      'tests/fixtures/test.pdf'
    );

    await page.waitForSelector('[data-testid="file-preview"]');
    expect(await page.isVisible('[data-testid="file-preview"]')).toBe(true);
  });

  test('should switch between sessions', async ({ page }) => {
    // 创建新会话
    await page.click('[data-testid="new-session"]');
    await page.waitForSelector('[data-testid="session-item"]');

    // 切换会话
    await page.click('[data-testid="session-item"]:first-child');
    expect(await page.getAttribute('[data-testid="session-item"]:first-child', 'class')).toContain('active');
  });
});
```

---

## 七、部署配置

### 7.1 环境配置

```typescript
// .env.example
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://ws.example.com
NEXT_PUBLIC_APP_NAME=AI对话平台
NEXT_PUBLIC_APP_VERSION=1.0.0

# 服务端环境变量（不暴露到客户端）
DATABASE_URL=postgresql://user:pass@localhost:5432/chat
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-key
```

### 7.2 Docker配置

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# 安装依赖
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 构建应用
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 运行应用
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

### 7.3 Kubernetes配置

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-chat-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-chat-frontend
  template:
    metadata:
      labels:
        app: ai-chat-frontend
    spec:
      containers:
      - name: frontend
        image: ai-chat-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.example.com"
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## 八、监控与分析

### 8.1 性能监控

```typescript
// lib/analytics.ts
import { Analytics } from '@vercel/analytics/react';

export function initAnalytics() {
  // 页面访问统计
  Analytics.track('page_view', {
    path: window.location.pathname,
    referrer: document.referrer,
  });

  // 性能指标收集
  if ('performance' in window) {
    const perfData = performance.getEntriesByType('navigation')[0];
    Analytics.track('performance', {
      dnsTime: perfData.domainLookupEnd - perfData.domainLookupStart,
      connectTime: perfData.connectEnd - perfData.connectStart,
      ttfb: perfData.responseStart - perfData.requestStart,
      domReady: perfData.domContentLoadedEventEnd,
      loadTime: perfData.loadEventEnd,
    });
  }
}

// 对话行为统计
export function trackChatEvent(event: string, data: object) {
  Analytics.track(event, {
    ...data,
    timestamp: Date.now(),
  });
}
```

### 8.2 错误监控

```typescript
// app/error.tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  Sentry.captureException(error);

  return (
    <html>
      <body>
        <ErrorBoundary
          error={error}
          onRetry={reset}
          onReport={() => Sentry.showReportDialog()}
        />
      </body>
    </html>
  );
}
```

---

**技术方案版本历史**

| 版本 | 日期 | 变更说明 |
|-----|------|---------|
| v1.0 | 2026-04-03 | 初始版本，完整前端技术方案 |