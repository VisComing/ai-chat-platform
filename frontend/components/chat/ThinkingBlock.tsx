'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
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
          <div className="break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-[#3b82f6]">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
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
                        className="my-3 py-2 px-4 bg-[#3b82f6]/10 rounded-lg overflow-x-auto text-center"
                        {...props}
                      >
                        {children}
                      </div>
                    )
                  }
                  return <div {...props}>{children}</div>
                },
                code: ({ className, children, ...props }) => {
                  // 行内代码（非数学公式）
                  if (!className?.includes('katex') && !className?.includes('language-')) {
                    return (
                      <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#3b82f6]/10" {...props}>
                        {children}
                      </code>
                    )
                  }
                  return <code className={cn('px-1.5 py-0.5 rounded text-xs font-mono bg-[#3b82f6]/10', className)} {...props}>{children}</code>
                },
                pre: ({ children }) => <>{children}</>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="ml-2">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[#3b82f6]/30 pl-3 my-2 text-[#64748b]">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-[#3b82f6] animate-pulse ml-0.5 rounded-full" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}