'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Search, ExternalLink, Globe } from 'lucide-react'
import type { Source } from '@/types'

interface SearchResultsPreviewProps {
  sources: Source[]
  query?: string
  isStreaming?: boolean
  className?: string
}

export function SearchResultsPreview({
  sources,
  query,
  isStreaming,
  className,
}: SearchResultsPreviewProps) {
  if (!sources || sources.length === 0) return null

  // 提取域名
  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  }

  return (
    <div
      className={cn(
        'mb-3 p-3 rounded-lg',
        'bg-gray-50 dark:bg-gray-800/50',
        'border border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {/* 搜索状态标题 */}
      <div className="flex items-center gap-2 mb-2">
        <Search
          className={cn(
            'w-4 h-4 text-blue-500',
            isStreaming && 'animate-pulse'
          )}
        />
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {isStreaming
            ? `正在搜索"${query || ''}"...`
            : `搜索到 ${sources.length} 个结果`
          }
        </span>
      </div>

      {/* 链接列表 */}
      <div className="flex flex-wrap gap-2">
        {sources.map((source, index) => (
          <a
            key={source.id || index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs font-medium',
              'bg-white dark:bg-gray-900',
              'border border-gray-200 dark:border-gray-600',
              'hover:border-blue-400 hover:text-blue-600',
              'dark:hover:border-blue-500 dark:hover:text-blue-400',
              'transition-colors cursor-pointer',
              'max-w-full truncate'
            )}
            title={source.title}
          >
            {/* 序号 */}
            <span
              className={cn(
                'flex-shrink-0 w-4 h-4 flex items-center justify-center',
                'rounded-full text-[10px]',
                'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              )}
            >
              {index + 1}
            </span>

            {/* 域名图标 */}
            <Globe className="w-3 h-3 flex-shrink-0 text-gray-400" />

            {/* 域名 */}
            <span className="truncate">
              {getHostname(source.url)}
            </span>

            {/* 外链图标 */}
            <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-400 opacity-0 group-hover:opacity-100" />
          </a>
        ))}
      </div>

      {/* 搜索提示 */}
      {!isStreaming && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          点击链接查看原文，回答中将引用这些来源
        </p>
      )}
    </div>
  )
}