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
          'bg-[#3b82f6]/8 hover:bg-[#3b82f6]/12'
        )}
      >
        {/* Icon - 品牌蓝圆形背景 */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#3b82f6] flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-[#3b82f6]">
          深度思考
          {!isExpanded && !isStreaming && (
            <span className="ml-2 text-xs text-[#94a3b8]">
              ({stepCount} 步)
            </span>
          )}
        </span>

        {/* Status indicator */}
        {isStreaming && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-[#3b82f6]">思考中...</span>
          </div>
        )}

        {/* Expand/Collapse icon */}
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[#3b82f6]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#3b82f6]" />
        )}
      </button>

      {/* Content - 平滑展开动画 */}
      {isExpanded && (
        <div className="mt-2 px-4 py-3 rounded-xl text-sm leading-relaxed animate-fade-in bg-[#3b82f6]/5 text-[#212121] dark:text-white">
          <div className="whitespace-pre-wrap break-words">
            {content}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-[#3b82f6] animate-pulse ml-0.5 rounded-full" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}