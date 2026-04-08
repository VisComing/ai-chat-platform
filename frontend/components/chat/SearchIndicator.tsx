'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Search, CheckCircle, AlertCircle } from 'lucide-react'

export type SearchStatus = 'searching' | 'found' | 'failed'

interface SearchIndicatorProps {
  status: SearchStatus
  query?: string
  resultCount?: number
  duration?: number
  className?: string
}

export function SearchIndicator({
  status,
  query,
  resultCount,
  duration,
  className,
}: SearchIndicatorProps) {
  const statusConfig = {
    searching: {
      icon: Search,
      text: query ? `正在搜索"${query}"...` : '正在搜索相关信息...',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      animate: true,
    },
    found: {
      icon: CheckCircle,
      text: `找到 ${resultCount || 0} 条相关信息`,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      animate: false,
    },
    failed: {
      icon: AlertCircle,
      text: '搜索服务暂时不可用',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-800/20',
      borderColor: 'border-gray-200 dark:border-gray-700',
      animate: false,
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <Icon
        className={cn(
          'w-5 h-5 flex-shrink-0',
          config.color,
          config.animate && 'animate-pulse'
        )}
      />
      
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', config.color)}>
          {config.text}
        </p>
        
        {status === 'searching' && (
          <div className="mt-2 h-1 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-1000"
              style={{ width: '60%' }}
            />
          </div>
        )}
      </div>
      
      {duration && status !== 'searching' && (
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          {duration}ms
        </span>
      )}
    </div>
  )
}

// 工具调用通知组件
interface ToolCallNotificationProps {
  toolName: string
  args?: Record<string, unknown>
  result?: {
    success: boolean
    message?: string
  }
  className?: string
}

export function ToolCallNotification({
  toolName,
  args,
  result,
  className,
}: ToolCallNotificationProps) {
  const isSearchTool = toolName === 'web_search'
  const queryText = args?.query ? String(args.query) : null

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 rounded-lg',
        'bg-gray-50 dark:bg-gray-800/50',
        'border border-gray-200 dark:border-gray-700',
        className
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {result ? (
          result.success ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )
        ) : (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {isSearchTool ? '联网搜索' : toolName}
        </p>
        
        {isSearchTool && queryText && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            查询: {queryText}
          </p>
        )}
        
        {result && result.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {result.message}
          </p>
        )}
      </div>
    </div>
  )
}