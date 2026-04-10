'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Search, ExternalLink, Globe, Brain } from 'lucide-react'
import type { IterationData, Source } from '@/types'
import { ThinkingBlock } from './ThinkingBlock'

interface IterationsDisplayProps {
  iterations: IterationData[]
  isStreaming?: boolean
}

export function IterationsDisplay({ iterations, isStreaming }: IterationsDisplayProps) {
  if (!iterations || iterations.length === 0) return null

  // Sort iterations: number iterations first, then 'final'
  const sortedIterations = [...iterations].sort((a, b) => {
    if (a.iteration === 'final') return 1
    if (b.iteration === 'final') return -1
    return (a.iteration as number) - (b.iteration as number)
  })

  return (
    <div className="mb-3 space-y-3">
      {sortedIterations.map((iter, index) => (
        <IterationBlock
          key={index}
          iteration={iter}
          isStreaming={isStreaming && index === sortedIterations.length - 1}
        />
      ))}
    </div>
  )
}

interface IterationBlockProps {
  iteration: IterationData
  isStreaming?: boolean
}

function IterationBlock({ iteration, isStreaming }: IterationBlockProps) {
  const iterNum = iteration.iteration
  const isFinal = iterNum === 'final'

  return (
    <div className="space-y-2">
      {/* 第1轮：Thinking + Tool Call */}
      {!isFinal && iteration.thinking && (
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center shrink-0 mt-0.5">
            <Brain className="w-3 h-3 text-[#f97316]" />
          </div>
          <div className="flex-1">
            <ThinkingBlock
              content={iteration.thinking}
              isStreaming={isStreaming}
              isDeepThinking={true}
              label={`第 ${iterNum} 轮思考`}
            />
          </div>
        </div>
      )}

      {/* Tool Call */}
      {!isFinal && iteration.toolCall && (
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-[#3b82f6]/20 flex items-center justify-center shrink-0 mt-0.5">
            <Globe className="w-3 h-3 text-[#3b82f6]" />
          </div>
          <div className="flex-1">
            <div className="p-2 bg-[#3b82f6]/8 rounded-lg text-sm">
              <span className="text-[#3b82f6] font-medium">
                🔍 调用搜索工具
              </span>
              {iteration.toolCall.args?.query && (
                <span className="text-[#64748b] ml-2">
                  查询: "{iteration.toolCall.args.query as string}"
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Result */}
      {!isFinal && iteration.searchResult && iteration.searchResult.sources.length > 0 && (
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-[#22c55e]/20 flex items-center justify-center shrink-0 mt-0.5">
            <Search className="w-3 h-3 text-[#22c55e]" />
          </div>
          <div className="flex-1">
            <div className="p-3 bg-[#f5f5f5] dark:bg-white/5 rounded-lg">
              <div className="text-sm font-medium text-[#64748b] mb-2">
                📄 搜索结果 ({iteration.searchResult.sources.length} 条)
              </div>
              <div className="space-y-2">
                {iteration.searchResult.sources.slice(0, 3).map((source, idx) => (
                  <SourceItem key={idx} source={source} />
                ))}
                {iteration.searchResult.sources.length > 3 && (
                  <div className="text-xs text-[#94a3b8]">
                    还有 {iteration.searchResult.sources.length - 3} 条结果...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Thinking */}
      {isFinal && iteration.thinking && (
        <ThinkingBlock
          content={iteration.thinking}
          isStreaming={isStreaming}
          isDeepThinking={true}
          label="最终思考"
        />
      )}
    </div>
  )
}

interface SourceItemProps {
  source: Source
}

function SourceItem({ source }: SourceItemProps) {
  const truncatedSnippet = source.snippet
    ? source.snippet.slice(0, 100) + (source.snippet.length > 100 ? '...' : '')
    : ''

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-2 bg-white dark:bg-white/5 rounded border border-[#e5e7eb] dark:border-white/10 hover:bg-[#f5f5f5] dark:hover:bg-white/10 transition-colors"
    >
      <div className="text-sm font-medium text-[#212121] dark:text-white line-clamp-1">
        {source.title || '无标题'}
      </div>
      {truncatedSnippet && (
        <div className="text-xs text-[#64748b] mt-1 line-clamp-2">
          {truncatedSnippet}
        </div>
      )}
      <div className="flex items-center gap-1 mt-1 text-xs text-[#94a3b8]">
        <ExternalLink className="w-3 h-3" />
        <span className="truncate max-w-[200px]">{source.url}</span>
      </div>
    </a>
  )
}