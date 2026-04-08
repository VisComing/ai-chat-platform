'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui'
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, MoreHorizontal, Search, ExternalLink, Clock, Globe } from 'lucide-react'
import type { Message, Source } from '@/types'
import { ThinkingBlock } from './ThinkingBlock'

interface MessageBubbleProps {
  message: Message
  onRegenerate?: () => void
  onCopy?: () => void
  onFeedback?: (type: 'like' | 'dislike') => void
  onDelete?: () => void
  showActions?: boolean
}

export function MessageBubble({
  message,
  onRegenerate,
  onCopy,
  onFeedback,
  onDelete,
  showActions = true,
}: MessageBubbleProps) {
  const [copied, setCopied] = React.useState(false)
  const [showAllActions, setShowAllActions] = React.useState(false)

  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'

  const handleCopy = async () => {
    const text = extractText(message.content)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy?.()
  }

  return (
    <div
      className={cn(
        'flex gap-3 py-4 px-4 animate-message-enter',
        isUser ? 'flex-row' : 'flex-row' // 统一左侧对齐
      )}
    >
      {/* Avatar */}
      {isUser ? (
        // 用户头像 - 品牌蓝圆形
        <div className="w-9 h-9 rounded-full bg-[#3b82f6] flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-medium">U</span>
        </div>
      ) : (
        // AI 头像 - 品牌蓝 + Bot 图标
        <div className="w-9 h-9 rounded-full bg-[#3b82f6] flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
            <circle cx="8" cy="14" r="2" />
            <circle cx="16" cy="14" r="2" />
          </svg>
        </div>
      )}

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Search Indicator with Sources */}
        {!isUser && message.metadata?.searchUsed && (
          <SearchIndicatorWithSources
            query={message.metadata.searchQuery || ''}
            sources={message.metadata.sources || []}
            isSearching={isStreaming && message.metadata.toolCall?.name === 'web_search'}
          />
        )}

        {/* Thinking Block */}
        {message.metadata?.thinking && !isUser && (
          <ThinkingBlock
            content={message.metadata.thinking}
            isStreaming={isStreaming}
            isDeepThinking={message.metadata.isDeepThinking}
          />
        )}

        {/* Tool Call Notification */}
        {!isUser && message.metadata?.toolCall && !isStreaming && (
          <div className="mb-2 p-2 bg-[#3b82f6]/8 rounded-lg text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-[#3b82f6]">
              已调用搜索工具获取最新信息
            </span>
          </div>
        )}

        {/* Message Bubble - 用户消息无背景 */}
        <div
          className={cn(
            'relative group',
            isUser
              ? 'text-[#212121] dark:text-white' // 用户消息：无背景，直接显示文字
              : isError
              ? 'text-red-500'
              : 'text-[#212121] dark:text-white' // AI 消息：无背景
          )}
        >
          {/* Content */}
          <MessageContent content={message.content} isUser={isUser} />

          {/* Streaming Indicator */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-[#3b82f6] animate-pulse ml-1 rounded-sm" />
          )}
        </div>

        {/* Actions - hover 显示 */}
        {showActions && !isUser && message.status === 'completed' && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 text-[#94a3b8] hover:text-[#212121] hover:bg-[#f5f5f5] dark:hover:bg-white/10 rounded transition-colors"
              title="复制"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onRegenerate}
              className="p-1.5 text-[#94a3b8] hover:text-[#212121] hover:bg-[#f5f5f5] dark:hover:bg-white/10 rounded transition-colors"
              title="重新生成"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onFeedback?.('like')}
              className="p-1.5 text-[#94a3b8] hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded transition-colors"
              title="好评"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onFeedback?.('dislike')}
              className="p-1.5 text-[#94a3b8] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
              title="差评"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-2 mt-1 text-xs text-[#94a3b8]">
          <span>{formatTime(message.createdAt)}</span>
          {message.metadata?.model && (
            <span className="text-[#64748b]">{message.metadata.model}</span>
          )}
          {message.metadata?.tokens && (
            <span className="text-[#64748b]">
              {message.metadata.tokens.input + message.metadata.tokens.output} tokens
            </span>
          )}
        </div>

              </div>
    </div>
  )
}

// Message Content Renderer
function MessageContent({ content, isUser }: { content: Message['content']; isUser: boolean }) {
  if (content.type === 'text') {
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            // 数学公式样式
            span({ className, children, ...props }) {
              if (className?.includes('katex')) {
                return <span className="text-base" {...props}>{children}</span>
              }
              return <span {...props}>{children}</span>
            },
            div({ className, children, ...props }) {
              if (className?.includes('katex-display')) {
                return (
                  <div
                    className="my-3 py-2 px-4 bg-secondary-50 dark:bg-secondary-900 rounded-lg overflow-x-auto text-center"
                    {...props}
                  >
                    {children}
                  </div>
                )
              }
              return <div {...props}>{children}</div>
            },
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              const code = String(children).replace(/\n$/, '')

              if (match) {
                return (
                  <CodeBlock language={match[1]} code={code} />
                )
              }
              // 行内代码（非数学公式）
              if (!className?.includes('katex')) {
                return (
                  <code
                    className={cn(
                      'px-1.5 py-0.5 rounded text-sm font-mono',
                      isUser ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-secondary-700'
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                )
              }
              return <code {...props}>{children}</code>
            },
            pre({ children }) {
              return <>{children}</>
            },
            a({ href, children }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 hover:underline"
                >
                  {children}
                </a>
              )
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-2">
                  <table className="min-w-full border-collapse border border-secondary-200">
                    {children}
                  </table>
                </div>
              )
            },
            th({ children }) {
              return (
                <th className="border border-secondary-200 px-4 py-2 bg-secondary-50 text-left font-medium">
                  {children}
                </th>
              )
            },
            td({ children }) {
              return (
                <td className="border border-secondary-200 px-4 py-2">
                  {children}
                </td>
              )
            },
          }}
        >
          {content.text}
        </ReactMarkdown>
      </div>
    )
  }

  if (content.type === 'image') {
    return (
      <img
        src={content.url}
        alt={content.alt || '图片'}
        className="max-w-full rounded-lg"
        loading="lazy"
      />
    )
  }

  if (content.type === 'code') {
    return <CodeBlock language={content.language} code={content.code} output={content.output} />
  }

  // 处理混合内容（文本+图片）
  if (content.type === 'mixed') {
    return (
      <div className="space-y-2">
        {content.parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <div key={index} className="whitespace-pre-wrap leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const code = String(children).replace(/\n$/, '')
                      if (match) {
                        return <CodeBlock language={match[1]} code={code} />
                      }
                      if (!className?.includes('katex')) {
                        return (
                          <code
                            className={cn(
                              'px-1.5 py-0.5 rounded text-sm font-mono',
                              isUser ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-secondary-700'
                            )}
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      }
                      return <code {...props}>{children}</code>
                    },
                    pre({ children }) {
                      return <>{children}</>
                    },
                  }}
                >
                  {part.text}
                </ReactMarkdown>
              </div>
            )
          }
          if (part.type === 'image') {
            return (
              <img
                key={index}
                src={part.url}
                alt={part.alt || '图片'}
                className="max-w-full rounded-lg"
                loading="lazy"
              />
            )
          }
          if (part.type === 'file') {
            return (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary-200 dark:bg-secondary-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm">{part.name}</span>
                <span className="text-xs text-secondary-400">
                  {(part.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )
          }
          return null
        })}
      </div>
    )
  }

  return null
}

// Code Block Component
function CodeBlock({
  language,
  code,
  output,
}: {
  language: string
  code: string
  output?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden bg-secondary-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-secondary-800">
        <span className="text-xs text-secondary-400 uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1 text-secondary-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      
      {/* Code */}
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm font-mono">{code}</code>
      </pre>

      {/* Output */}
      {output && (
        <div className="border-t border-secondary-700">
          <div className="px-4 py-2 bg-secondary-800 text-xs text-secondary-400">
            输出
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-green-400">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}

// Helper Functions
function extractText(content: Message['content']): string {
  if (content.type === 'text') return content.text
  if (content.type === 'code') return content.code
  if (content.type === 'mixed') {
    return content.parts.map(p => p.type === 'text' ? p.text : '').join('')
  }
  return ''
}

function formatTime(date: Date | string): string {
  // Handle date string without timezone - assume UTC
  let d: Date
  if (typeof date === 'string') {
    // If no timezone info, append 'Z' to treat as UTC
    d = date.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(date)
      ? new Date(date)
      : new Date(date + 'Z')
  } else {
    d = date
  }
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// Search Indicator with Sources Component
function SearchIndicatorWithSources({
  query,
  sources,
  isSearching
}: {
  query: string
  sources: Source[]
  isSearching: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="mb-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm overflow-hidden">
      {/* Header - always visible */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSearching ? (
              <>
                <div className="animate-spin">
                  <Search className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-blue-600 dark:text-blue-400">
                  正在搜索 "{query}"...
                </span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-blue-600 dark:text-blue-400">
                  已找到 {sources.length} 条相关结果
                </span>
              </>
            )}
          </div>

          {/* Toggle button - only show when has sources */}
          {!isSearching && sources.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              <span>{expanded ? '收起' : '查看来源'}</span>
              <svg
                className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
        {isSearching && (
          <div className="mt-2 h-1 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}
      </div>

      {/* Sources List - expandable */}
      {!isSearching && expanded && sources.length > 0 && (
        <div className="border-t border-blue-200 dark:border-blue-700 divide-y divide-blue-200 dark:divide-blue-700">
          {sources.map((source, index) => (
            <SourceCardInline key={source.id || index} source={source} index={index + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// Source Card Inline Component
function SourceCardInline({ source, index }: { source: Source; index: number }) {
  const relevanceScore = source.rerankScore
    ? Math.round(source.rerankScore * 100)
    : undefined

  const hostname = React.useMemo(() => {
    try {
      return new URL(source.url).hostname.replace(/^www\./, '')
    } catch {
      return source.url
    }
  }, [source.url])

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
    >
      <div className="flex items-start gap-2">
        {/* Citation Number */}
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center justify-center">
          {index}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {source.title}
          </h4>

          {/* Meta */}
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Globe className="w-3 h-3" />
            <span className="truncate">{hostname}</span>
            {source.publishedTime && (
              <>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>{formatPublishedTime(source.publishedTime)}</span>
              </>
            )}
            {relevanceScore !== undefined && (
              <>
                <span>•</span>
                <span className="text-green-500">{relevanceScore}% 相关</span>
              </>
            )}
          </div>
        </div>

        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    </a>
  )
}

function formatPublishedTime(time: string): string {
  const date = new Date(time)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffHours < 1) return '刚刚'
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
