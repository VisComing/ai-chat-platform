// Message Types
export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 
  | 'pending' 
  | 'streaming' 
  | 'completed' 
  | 'error' 
  | 'cancelled'

export type ContentType = 
  | 'text' 
  | 'image' 
  | 'file' 
  | 'code' 
  | 'mixed'

export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image'
  url: string
  alt?: string
}

export interface FileContent {
  type: 'file'
  name: string
  url: string
  size: number
  mimeType: string
}

export interface CodeContent {
  type: 'code'
  language: string
  code: string
  output?: string
}

export interface MixedContent {
  type: 'mixed'
  parts: (TextContent | ImageContent | FileContent)[]
}

export type MessageContent = TextContent | ImageContent | FileContent | CodeContent | MixedContent

export interface MessageMetadata {
  model?: string
  tokens?: {
    input: number
    output: number
  }
  thinking?: string
  isDeepThinking?: boolean  // Whether this is deep thinking mode (DeepSeek R1)
  sources?: Source[]
  citations?: Citation[]
  searchUsed?: boolean
  searchQuery?: string
  searchResultCount?: number
  toolCall?: {
    name: string
    args?: Record<string, unknown>
    result?: {
      success: boolean
      message?: string
    }
  }
  duration?: number
}

export interface Citation {
  number: number
  sourceId: string
  text: string
}

export interface Source {
  id?: string
  title: string
  url: string
  snippet?: string
  publishedTime?: string
  rerankScore?: number
  favicon?: string
}

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: MessageContent
  status: MessageStatus
  createdAt: Date
  updatedAt?: Date
  metadata?: MessageMetadata
}

// Session Types
export interface Session {
  id: string
  userId: string
  title: string
  systemPrompt?: string
  defaultModel?: string
  pinned: boolean
  archived: boolean
  messageCount: number
  lastMessageAt?: Date
  createdAt: Date
  updatedAt?: Date
  metadata?: Record<string, unknown>
}

// User Types
export interface User {
  id: string
  email: string
  username: string
  avatar?: string
  isActive: boolean
  isVerified: boolean
  createdAt: Date
  updatedAt?: Date
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// API Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Chat Types
export interface ChatRequest {
  sessionId?: string
  content: MessageContent
  model?: string
  temperature?: number
  maxTokens?: number
  enableThinking?: boolean
  tools?: Tool[]
  metadata?: Record<string, unknown>
}

export interface Tool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

// Stream Types
export interface StreamChunk {
  type: 'text' | 'thinking' | 'complete' | 'error' | 'tool_call' | 'session' | 'title' | 'search_start' | 'search_result'
  content?: string
  status?: string // For thinking events
  messageId?: string
  sessionId?: string
  title?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  resultCount?: number
  sources?: Source[] // 搜索结果，在 tool_call 事件中实时发送
  toolResult?: {
    success: boolean
    resultCount?: number
    sources?: Source[]
    message?: string
  }
  metadata?: MessageMetadata & {
    sources?: Source[]
    search_used?: boolean
  }
}

// Settings Types
export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  defaultModel: string
  temperature: number
  maxTokens: number
  enableThinking: boolean
  enableShortcuts: boolean
  enableSoundEffects: boolean
}
