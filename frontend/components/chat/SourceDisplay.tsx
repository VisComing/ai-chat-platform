'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ExternalLink, BookOpen, Clock } from 'lucide-react'
import type { Source } from '@/types'

// 引用角标组件
interface CitationBadgeProps {
  number: number
  source?: Source
  onClick?: () => void
  onHover?: (source: Source | null) => void
  className?: string
}

export function CitationBadge({
  number,
  source,
  onClick,
  onHover,
  className,
}: CitationBadgeProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => source && onHover?.(source)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'inline-flex items-center justify-center',
        'w-5 h-5 text-xs font-medium',
        'text-blue-600 dark:text-blue-400',
        'bg-blue-100 dark:bg-blue-900/30',
        'rounded-full',
        'hover:bg-blue-200 dark:hover:bg-blue-900/50',
        'transition-colors cursor-pointer',
        'align-super',
        className
      )}
      title={source?.title || `来源 ${number}`}
      aria-label={`查看来源 ${number}: ${source?.title || ''}`}
    >
      {number}
    </button>
  )
}

// 来源卡片组件
interface SourceCardProps {
  source: Source
  number: number
  id?: string
  highlighted?: boolean
  className?: string
}

export function SourceCard({
  source,
  number,
  id,
  highlighted,
  className,
}: SourceCardProps) {
  const [imageError, setImageError] = React.useState(false)
  
  const hostname = React.useMemo(() => {
    try {
      return new URL(source.url).hostname
    } catch {
      return source.url
    }
  }, [source.url])
  
  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      
      if (diffMins < 60) return `${diffMins}分钟前`
      if (diffHours < 24) return `${diffHours}小时前`
      if (diffDays < 7) return `${diffDays}天前`
      return date.toLocaleDateString('zh-CN')
    } catch {
      return ''
    }
  }

  return (
    <a
      id={id}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg',
        'border border-gray-200 dark:border-gray-700',
        'hover:border-blue-300 dark:hover:border-blue-600',
        'hover:bg-blue-50 dark:hover:bg-blue-900/10',
        'transition-all duration-200',
        'group',
        highlighted && 'bg-blue-50 dark:bg-blue-900/20 border-blue-300',
        className
      )}
    >
      {/* 编号 */}
      <span
        className={cn(
          'flex-shrink-0 w-6 h-6 flex items-center justify-center',
          'text-xs font-medium',
          'text-blue-600 dark:text-blue-400',
          'bg-blue-100 dark:bg-blue-900/30',
          'rounded-full',
          'group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50',
          'transition-colors'
        )}
      >
        {number}
      </span>
      
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {/* 标题 */}
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {source.title}
        </h4>
        
        {/* 元信息 */}
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
          {/* Favicon */}
          {source.favicon && !imageError && (
            <img
              src={source.favicon}
              alt=""
              className="w-3 h-3"
              onError={() => setImageError(true)}
            />
          )}
          
          {/* 域名 */}
          <span className="truncate">{hostname}</span>
          
          {/* 发布时间 */}
          {source.publishedTime && (
            <>
              <span>•</span>
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(source.publishedTime)}</span>
            </>
          )}
          
          {/* 相关性得分 */}
          {source.rerankScore && (
            <>
              <span>•</span>
              <span className="text-green-600 dark:text-green-400">
                {Math.round(source.rerankScore * 100)}% 相关
              </span>
            </>
          )}
        </div>
        
        {/* 摘要 */}
        {source.snippet && (
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
            {source.snippet}
          </p>
        )}
      </div>
      
      {/* 外链图标 */}
      <ExternalLink
        className={cn(
          'w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0',
          'group-hover:text-blue-500 dark:group-hover:text-blue-400',
          'transition-colors'
        )}
      />
    </a>
  )
}

// 参考来源区域组件
interface SourcesSectionProps {
  sources: Source[]
  className?: string
}

export function SourcesSection({ sources, className }: SourcesSectionProps) {
  const [highlightedNumber, setHighlightedNumber] = React.useState<number | null>(null)
  
  if (!sources || sources.length === 0) return null

  return (
    <div className={cn('mt-4 pt-4 border-t border-gray-200 dark:border-gray-700', className)}>
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          参考来源
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          ({sources.length})
        </span>
      </div>
      
      {/* 来源列表 */}
      <div className="space-y-2">
        {sources.map((source, index) => (
          <SourceCard
            key={source.id || index}
            source={source}
            number={index + 1}
            id={`source-${index + 1}`}
            highlighted={highlightedNumber === index + 1}
          />
        ))}
      </div>
    </div>
  )
}

// 引用预览浮层组件
interface CitationPreviewProps {
  source: Source | null
  position?: { x: number; y: number }
}

export function CitationPreview({ source, position }: CitationPreviewProps) {
  if (!source) return null
  
  return (
    <div
      className={cn(
        'fixed z-50 p-3 rounded-lg shadow-lg',
        'bg-white dark:bg-gray-800',
        'border border-gray-200 dark:border-gray-700',
        'max-w-xs'
      )}
      style={{
        left: position?.x || 0,
        top: position?.y || 0,
        transform: 'translate(-50%, -100%) translateY(-8px)',
      }}
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
        {source.title}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
        {source.url}
      </p>
      {source.snippet && (
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-3">
          {source.snippet}
        </p>
      )}
    </div>
  )
}