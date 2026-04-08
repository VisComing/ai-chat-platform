'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { MessageBubble } from './MessageBubble'
import type { Message } from '@/types'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  onRegenerate?: (messageId: string) => void
  onCopy?: (messageId: string) => void
  onFeedback?: (messageId: string, type: 'like' | 'dislike') => void
  onDelete?: (messageId: string) => void
  onSuggestionClick?: (text: string) => void
}

export function MessageList({
  messages,
  isLoading,
  onRegenerate,
  onCopy,
  onFeedback,
  onDelete,
  onSuggestionClick,
}: MessageListProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = React.useState(true)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  // Handle scroll
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    // User is near bottom, enable auto-scroll
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100)
  }, [])

  // Jump to bottom
  const scrollToBottom = React.useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
    }
  }, [])

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4"
      >
        {messages.length === 0 && !isLoading ? (
          <EmptyState onSuggestionClick={onSuggestionClick} />
        ) : (
          <div className="max-w-4xl mx-auto">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onRegenerate={() => onRegenerate?.(message.id)}
                onCopy={() => onCopy?.(message.id)}
                onFeedback={(type) => onFeedback?.(message.id, type)}
                onDelete={() => onDelete?.(message.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scroll to Bottom Button */}
      {!autoScroll && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Empty State - 欢迎卡片优化
function EmptyState({ onSuggestionClick }: { onSuggestionClick?: (text: string) => void }) {
  const suggestions = [
    { icon: '💡', text: '帮我解释一下量子计算', color: 'from-yellow-400 to-orange-400' },
    { icon: '📝', text: '写一封商务邮件', color: 'from-primary-400 to-accent-400' },
    { icon: '🔧', text: '帮我调试这段代码', color: 'from-green-400 to-emerald-400' },
    { icon: '📊', text: '分析这份数据的趋势', color: 'from-purple-400 to-pink-400' },
  ]

  const handleClick = (text: string) => {
    console.log('[EmptyState] Button clicked, text:', text)
    console.log('[EmptyState] onSuggestionClick exists:', !!onSuggestionClick)
    onSuggestionClick?.(text)
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-fade-in">
      {/* 大图标容器 - 蓝紫渐变 */}
      <div className="w-24 h-24 mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg">
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>

      {/* 标题 */}
      <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-3">
        今天想聊点什么？
      </h2>

      {/* 副标题 */}
      <p className="text-secondary-500 dark:text-secondary-400 max-w-md mb-10 leading-relaxed">
        我可以帮你写作、编程、分析数据、解答问题。选择下方模板快速开始，或直接输入你的问题。
      </p>

      {/* Quick Start Suggestions - 悬停动效 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => handleClick(suggestion.text)}
            className="group flex items-center gap-3 p-4 text-left rounded-xl
                       bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700
                       hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20
                       hover:shadow-md hover:-translate-y-0.5
                       transition-all duration-200"
          >
            {/* 图标容器 */}
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center text-xl',
              `bg-gradient-to-br ${suggestion.color}`
            )}>
              {suggestion.icon}
            </div>
            <span className="text-sm text-secondary-700 dark:text-secondary-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {suggestion.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
