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
        'flex gap-2 sm:gap-3 py-3 sm:py-4 px-3 sm:px-4 animate-message-enter',
        isUser ? 'flex-row' : 'flex-row' // 统一左侧对齐
      )}
    >
      {/* Avatar */}
      {isUser ? (
        // 用户头像 - 品牌蓝圆形，移动端缩小
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#3b82f6] flex items-center justify-center shrink-0">
          <span className="text-white text-xs sm:text-sm font-medium">U</span>
        </div>
      ) : (
        // AI 头像 - 品牌蓝 + Bot 图标，移动端缩小
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#3b82f6] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
            <circle cx="8" cy="14" r="2" />
            <circle cx="16" cy="14" r="2" />
          </svg>
        </div>
      )}

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Thinking Block - 深度思考内容 */}
        {!isUser && message.metadata?.thinking && (
          <ThinkingBlock
            content={message.metadata.thinking}
            isStreaming={isStreaming}
            isDeepThinking={message.metadata.isDeepThinking}
          />
        )}

        {/* Tool Call - 搜索工具调用指示 */}
        {!isUser && message.metadata?.toolCall && (
          <div className="mb-2 p-2 bg-[#3b82f6]/8 rounded-lg text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-[#3b82f6]">
              {isStreaming ? '正在调用搜索工具...' : '已调用搜索工具获取最新信息'}
            </span>
            {message.metadata.toolCall.args?.query && (
              <span className="text-[#64748b]">
                查询: "{message.metadata.toolCall.args.query}"
              </span>
            )}
          </div>
        )}

        {/* Search Result - 搜索结果 */}
        {!isUser && message.metadata?.searchUsed && message.metadata?.sources && message.metadata.sources.length > 0 && (
          <SearchIndicatorWithSources
            query={message.metadata.searchQuery || ''}
            sources={message.metadata.sources || []}
            isSearching={isStreaming && message.metadata.toolCall?.name === 'web_search'}
          />
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

        {/* Actions - hover 显示（桌面端），移动端始终显示 */}
        {showActions && !isUser && message.status === 'completed' && (
          <div className="flex items-center gap-1 mt-2 opacity-0 sm:group-hover:opacity-100 transition-opacity sm:opacity-0">
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
    <div className="mb-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shadow-slate-200/50 dark:shadow-slate-900/20 overflow-hidden">
      {/* Header - always visible */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/10 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isSearching ? (
              <>
                <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <div className="animate-spin">
                    <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  正在搜索 &quot;{query}&quot;...
                </span>
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  已找到 <span className="text-blue-600 dark:text-blue-400 font-semibold">{sources.length}</span> 条相关结果
                </span>
              </>
            )}
          </div>

          {/* Toggle button - only show when has sources */}
          {!isSearching && sources.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
            >
              <span>{expanded ? '收起' : '查看来源'}</span>
              <svg
                className={cn("w-3.5 h-3.5 transition-transform duration-200", expanded && "rotate-180")}
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
          <div className="mt-3 h-1 bg-blue-200/50 dark:bg-blue-800/50 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse w-full" />
          </div>
        )}
      </div>

      {/* Sources List - expandable */}
      {!isSearching && expanded && sources.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
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

  // Get favicon URL from hostname
  const faviconUrl = React.useMemo(() => {
    try {
      const hostname = new URL(source.url).hostname
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    } catch {
      return null
    }
  }, [source.url])

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block px-4 py-3 hover:bg-white dark:hover:bg-slate-800/50 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        {/* Citation Number - Enhanced */}
        <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-semibold flex items-center justify-center shadow-sm shadow-blue-500/20 group-hover:shadow-blue-500/30 group-hover:scale-105 transition-all duration-200">
          {index}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title - Enhanced with better typography */}
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-relaxed">
            {source.title}
          </h4>

          {/* Meta - Enhanced with favicon */}
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt=""
                className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="truncate max-w-[150px] font-medium">{hostname}</span>
            {source.publishedTime && (
              <>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-slate-400 dark:text-slate-500">{formatPublishedTime(source.publishedTime)}</span>
              </>
            )}
            {relevanceScore !== undefined && (
              <>
                <span className="text-slate-300 dark:text-slate-500">•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{relevanceScore}% 相关</span>
              </>
            )}
          </div>
        </div>

        {/* External Link - Enhanced with hover effect */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2 transition-all duration-200">
          <ExternalLink className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </div>
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
