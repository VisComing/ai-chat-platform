'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui'
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'
import { SearchIndicator, ToolCallNotification } from './SearchIndicator'
import { SearchResultsPreview } from './SearchResultsPreview'
import { CitationBadge, SourcesSection } from './SourceDisplay'
import type { Message, Source } from '@/types'

interface MessageBubbleEnhancedProps {
  message: Message
  onRegenerate?: () => void
  onCopy?: () => void
  onFeedback?: (type: 'like' | 'dislike') => void
  onDelete?: () => void
  showActions?: boolean
}

export function MessageBubbleEnhanced({
  message,
  onRegenerate,
  onCopy,
  onFeedback,
  onDelete,
  showActions = true,
}: MessageBubbleEnhancedProps) {
  const [copied, setCopied] = React.useState(false)
  const [highlightedSource, setHighlightedSource] = React.useState<number | null>(null)
  
  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'
  
  // 搜索相关状态
  const searchUsed = message.metadata?.searchUsed
  const searchQuery = message.metadata?.searchQuery
  const sources = message.metadata?.sources || []
  
  const handleCopy = async () => {
    const text = extractText(message.content)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy?.()
  }
  
  const scrollToSource = (number: number) => {
    const element = document.getElementById(`source-${number}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedSource(number)
      setTimeout(() => setHighlightedSource(null), 2000)
    }
  }

  return (
    <div
      className={cn(
        'flex gap-3 py-4 px-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <Avatar
        src={isUser ? undefined : '/icons/bot.svg'}
        alt={isUser ? '用户' : 'AI助手'}
        fallback={isUser ? 'U' : 'AI'}
        size="md"
      />

      {/* Message Content */}
      <div
        className={cn(
          'flex-1 max-w-[70%]',
          isUser ? 'items-end' : 'items-start',
          'flex flex-col'
        )}
      >
        {/* 搜索结果预览 - 实时展示搜索到的链接 */}
        {!isUser && sources.length > 0 && (
          <div className="mb-2">
            <SearchResultsPreview
              sources={sources}
              query={searchQuery}
              isStreaming={isStreaming && searchUsed}
            />
          </div>
        )}

        {/* 工具调用通知 */}
        {!isUser && message.metadata?.toolCall && (
          <div className="mb-2">
            <ToolCallNotification
              toolName={message.metadata.toolCall.name}
              args={message.metadata.toolCall.args}
              result={message.metadata.toolCall.result}
            />
          </div>
        )}

        {/* Thinking Block */}
        {message.metadata?.thinking && !isUser && (
          <div className="mb-2 p-3 bg-secondary-100 dark:bg-secondary-800 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-secondary-500 mb-1">
              <span className="text-xs font-medium">思考过程</span>
            </div>
            <p className="text-secondary-600 dark:text-secondary-300 whitespace-pre-wrap">
              {message.metadata.thinking}
            </p>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 relative group',
            isUser
              ? 'bg-primary-500 text-white rounded-tr-sm'
              : isError
              ? 'bg-error-light text-error rounded-tl-sm'
              : 'bg-secondary-100 dark:bg-secondary-800 text-secondary-900 dark:text-white rounded-tl-sm'
          )}
        >
          {/* Content */}
          <MessageContentEnhanced
            content={message.content}
            isUser={isUser}
            sources={sources}
            onCitationClick={scrollToSource}
            onCitationHover={setHighlightedSource}
          />
          
          {/* Streaming Indicator */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-1" />
          )}
        </div>

        {/* 参考来源 */}
        {!isUser && sources.length > 0 && message.status === 'completed' && (
          <SourcesSection sources={sources} className="mt-3" />
        )}

        {/* Actions */}
        {showActions && !isUser && message.status === 'completed' && (
          <div
            className={cn(
              'flex items-center gap-1 mt-1 transition-opacity',
              'opacity-0 group-hover:opacity-100'
            )}
          >
            <button
              onClick={handleCopy}
              className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded transition-colors"
              title="复制"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onRegenerate}
              className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded transition-colors"
              title="重新生成"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onFeedback?.('like')}
              className="p-1.5 text-secondary-400 hover:text-success hover:bg-success-light rounded transition-colors"
              title="好评"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onFeedback?.('dislike')}
              className="p-1.5 text-secondary-400 hover:text-error hover:bg-error-light rounded transition-colors"
              title="差评"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Meta Info */}
        <div
          className={cn(
            'flex items-center gap-2 mt-1 text-xs text-secondary-400',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {message.metadata?.model && (
            <span className="text-secondary-300">{message.metadata.model}</span>
          )}
          {message.metadata?.tokens && (
            <span className="text-secondary-300">
              {message.metadata.tokens.input + message.metadata.tokens.output} tokens
            </span>
          )}
          {searchUsed && (
            <span className="text-blue-500 dark:text-blue-400">• 已联网搜索</span>
          )}
        </div>
      </div>
    </div>
  )
}

// Enhanced Message Content Renderer with Citations
function MessageContentEnhanced({
  content,
  isUser,
  sources,
  onCitationClick,
  onCitationHover,
}: {
  content: Message['content']
  isUser: boolean
  sources: Source[]
  onCitationClick?: (number: number) => void
  onCitationHover?: (number: number | null) => void
}) {
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
            // 处理引用角标
            sup: ({ children, ...props }) => {
              const text = children?.toString() || ''
              const match = text.match(/\[(\d+)\]/)

              if (match && sources.length > 0) {
                const number = parseInt(match[1])
                const source = sources[number - 1]

                return (
                  <CitationBadge
                    number={number}
                    source={source}
                    onClick={() => onCitationClick?.(number)}
                    onHover={(s) => onCitationHover?.(s ? number : null)}
                  />
                )
              }

              return <sup {...props}>{children}</sup>
            },
            // 代码块
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              const code = String(children).replace(/\n$/, '')

              if (match) {
                return <CodeBlock language={match[1]} code={code} />
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
            // 链接
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
            // 表格
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
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden bg-secondary-900 text-white">
      <div className="flex items-center justify-between px-4 py-2 bg-secondary-800">
        <span className="text-xs text-secondary-400 uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1 text-secondary-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm font-mono">{code}</code>
      </pre>
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