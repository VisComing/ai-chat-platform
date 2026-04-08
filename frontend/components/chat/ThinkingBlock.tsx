'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Brain, Lightbulb } from 'lucide-react'

interface ThinkingBlockProps {
  content: string
  isStreaming?: boolean
  isDeepThinking?: boolean
}

export function ThinkingBlock({ content, isStreaming, isDeepThinking }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  // Auto-expand when streaming starts, collapse when done
  React.useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true)
    }
  }, [isStreaming])

  if (!content) return null

  // 计算思考步骤数（简单估算）
  const stepCount = content.split('\n').filter(line => line.trim()).length

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200 text-left',
          isDeepThinking
            ? 'bg-gradient-to-r from-purple-50 via-primary-50 to-accent-50 dark:from-purple-900/20 dark:via-primary-900/20 dark:to-accent-900/20 hover:from-purple-100 hover:via-primary-100 hover:to-accent-100'
            : 'bg-secondary-100 dark:bg-secondary-800 hover:bg-secondary-200 dark:hover:bg-secondary-700'
        )}
      >
        {/* Icon - 蓝紫渐变圆形背景 + 脑电波动画 */}
        <div className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center shadow-sm',
          isDeepThinking
            ? 'bg-gradient-to-br from-primary-400 to-accent-400 animate-pulse-glow'
            : 'bg-secondary-200 dark:bg-secondary-700'
        )}>
          {isDeepThinking ? (
            <Brain className="w-4 h-4 text-white animate-brain-wave" />
          ) : (
            <Lightbulb className="w-4 h-4 text-secondary-600 dark:text-secondary-400" />
          )}
        </div>

        {/* Title */}
        <span className={cn(
          'flex-1 text-sm font-medium',
          isDeepThinking
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-secondary-600 dark:text-secondary-400'
        )}>
          {isDeepThinking ? '深度思考' : '思考过程'}
          {/* 收起时显示摘要 */}
          {!isExpanded && !isStreaming && (
            <span className="ml-2 text-xs text-secondary-400">
              ({stepCount} 步)
            </span>
          )}
        </span>

        {/* Status indicator */}
        {isStreaming && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-primary-500">思考中...</span>
          </div>
        )}

        {/* Expand/Collapse icon */}
        {isExpanded ? (
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform',
            isDeepThinking ? 'text-primary-500' : 'text-secondary-500'
          )} />
        ) : (
          <ChevronRight className={cn(
            'w-4 h-4 transition-transform',
            isDeepThinking ? 'text-primary-500' : 'text-secondary-500'
          )} />
        )}
      </button>

      {/* Content - 平滑展开动画 */}
      {isExpanded && (
        <div className={cn(
          'mt-2 px-4 py-3 rounded-xl text-sm leading-relaxed animate-fade-in',
          isDeepThinking
            ? 'bg-gradient-to-r from-purple-50/30 via-primary-50/30 to-accent-50/30 dark:from-purple-900/10 dark:via-primary-900/10 dark:to-accent-900/10 text-primary-900 dark:text-primary-100'
            : 'bg-secondary-50 dark:bg-secondary-800/50 text-secondary-700 dark:text-secondary-300'
        )}>
          <div className="whitespace-pre-wrap break-words">
            {content}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-gradient-to-r from-primary-500 to-accent-500 animate-pulse ml-0.5 rounded-full" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}