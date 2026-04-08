'use client'

import { cn } from '@/lib/utils'
import { Button, SessionItemSkeleton } from '@/components/ui'
import { useSessionStore } from '@/stores/sessionStore'
import { formatRelativeTime } from '@/lib/utils'
import {
  Menu,
  Plus,
  Search,
  Settings,
  MessageSquare,
  Star,
  Archive,
  Trash2,
  ChevronRight,
  MoreHorizontal,
  Bot,
  X,
  ChevronDown,
  LogOut,
  HelpCircle,
  Moon,
  Sun,
  User,
} from 'lucide-react'
import { useState } from 'react'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  onNewChat: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteCurrentSession?: () => void
}

export function Sidebar({ isOpen, onToggle, onNewChat, onSelectSession, onDeleteCurrentSession }: SidebarProps) {
  const {
    sessions,
    currentSessionId,
    deleteSession,
    pinSession,
    archiveSession,
    isLoading,
  } = useSessionStore()

  const [activeTab, setActiveTab] = useState<'chat' | 'favorites' | 'archive'>('chat')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter sessions based on active tab and search
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase())

    if (activeTab === 'chat') {
      return !session.archived && matchesSearch
    } else if (activeTab === 'favorites') {
      return session.pinned && !session.archived && matchesSearch
    } else if (activeTab === 'archive') {
      return session.archived && matchesSearch
    }
    return true
  })

  // Helper to parse UTC date string
  const parseUTCDate = (date: Date | string | undefined): number => {
    if (!date) return 0
    if (typeof date === 'string') {
      // If no timezone info, append 'Z' to treat as UTC
      const d = date.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(date)
        ? new Date(date)
        : new Date(date + 'Z')
      return d.getTime()
    }
    return new Date(date).getTime()
  }

  // Sort: pinned first, then by last message time (fallback to createdAt for new sessions)
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    const dateA = parseUTCDate(a.lastMessageAt) || parseUTCDate(a.createdAt)
    const dateB = parseUTCDate(b.lastMessageAt) || parseUTCDate(b.createdAt)
    return dateB - dateA
  })

  return (
    <>
      {/* Collapsed Sidebar Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-0 top-4 z-50 p-2 bg-secondary-900 text-white hover:bg-secondary-800 rounded-r-lg shadow-lg transition-colors"
          aria-label="展开侧边栏"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'h-screen bg-secondary-900 text-white flex flex-col transition-all duration-300',
          isOpen ? 'w-64' : 'w-0 overflow-hidden'
        )}
      >
        {/* Header - 品牌区升级 */}
        <div className="p-4 flex items-center justify-between border-b border-secondary-700/50">
          <div className="flex items-center gap-3">
            {/* 蓝紫渐变 Logo + 流光效果 */}
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shimmer-container">
              <Bot className="w-5 h-5 text-white relative z-10" />
            </div>
            <span className="font-semibold text-lg bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              AI助手
            </span>
          </div>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-secondary-800 rounded-lg transition-colors"
            title="收起侧边栏"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button - 渐变填充按钮 */}
        <div className="p-3">
          <Button
            onClick={onNewChat}
            className="w-full justify-start gap-2 bg-gradient-to-r from-primary-500 to-accent-500
                       hover:from-primary-600 hover:to-accent-600 hover:shadow-lg hover:-translate-y-0.5
                       text-white border-none transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>新对话</span>
          </Button>
        </div>

        {/* Search - 圆角搜索栏 + 清除按钮 */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              type="text"
              placeholder="搜索对话历史..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-secondary-800/50 text-white
                         placeholder:text-secondary-500 rounded-xl text-sm
                         focus:outline-none focus:bg-secondary-700 focus:ring-2 focus:ring-primary-500/50
                         transition-all duration-200"
            />
            {/* 清除按钮 - 输入内容时显示 */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-secondary-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 pb-2 flex gap-1">
          {[
            { id: 'chat', label: '对话', icon: MessageSquare },
            { id: 'favorites', label: '收藏', icon: Star },
            { id: 'archive', label: '归档', icon: Archive },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm transition-colors',
                activeTab === id
                  ? 'bg-secondary-700 text-white'
                  : 'text-secondary-400 hover:text-white hover:bg-secondary-800'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <>
              <SessionItemSkeleton />
              <SessionItemSkeleton />
              <SessionItemSkeleton />
            </>
          ) : sortedSessions.length === 0 ? (
            <div className="p-4 text-center text-secondary-400 text-sm">
              {searchQuery ? '没有找到匹配的对话' : '暂无对话'}
            </div>
          ) : (
            sortedSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                onClick={() => onSelectSession(session.id)}
                onDelete={() => {
                  const isCurrentSession = session.id === currentSessionId
                  deleteSession(session.id)
                  if (isCurrentSession && onDeleteCurrentSession) {
                    onDeleteCurrentSession()
                  }
                }}
                onPin={() => pinSession(session.id)}
                onArchive={() => archiveSession(session.id)}
              />
            ))
          )}
        </div>

        {/* Footer - 用户功能区 */}
        <div className="p-3 border-t border-secondary-700/50">
          <UserMenu />
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  )
}

// User Menu Component - 底部用户功能区
function UserMenu() {
  const [showMenu, setShowMenu] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    }
    setShowMenu(false)
  }

  return (
    <div className="relative">
      {/* User Avatar Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">用户</span>
        <ChevronDown className={cn(
          'w-4 h-4 text-secondary-400 transition-transform',
          showMenu && 'rotate-180'
        )} />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-secondary-800 rounded-lg shadow-xl border border-secondary-700 py-1 z-10">
          <button
            onClick={() => {}}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-secondary-700"
          >
            <Settings className="w-4 h-4" />
            个人设置
          </button>

          {/* Theme Submenu */}
          <div className="border-t border-secondary-700 mt-1 pt-1">
            <div className="px-3 py-1 text-xs text-secondary-400">主题</div>
            {[
              { id: 'light', icon: Sun, label: '浅色' },
              { id: 'dark', icon: Moon, label: '深色' },
              { id: 'system', icon: Settings, label: '跟随系统' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => handleThemeChange(id as typeof theme)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary-700',
                  theme === id ? 'text-primary-400' : 'text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {theme === id && <span className="ml-auto text-primary-400">✓</span>}
              </button>
            ))}
          </div>

          <div className="border-t border-secondary-700 mt-1 pt-1">
            <button
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-secondary-700"
            >
              <HelpCircle className="w-4 h-4" />
              帮助中心
            </button>
            <button
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-secondary-700"
            >
              <LogOut className="w-4 h-4" />
              登出
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Session Item Component
function SessionItem({
  session,
  isActive,
  onClick,
  onDelete,
  onPin,
  onArchive,
}: {
  session: {
    id: string
    title: string
    pinned: boolean
    archived: boolean
    lastMessageAt?: Date
    updatedAt?: Date
    createdAt?: Date
  }
  isActive: boolean
  onClick: () => void
  onDelete: () => void
  onPin: () => void
  onArchive: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      className={cn(
        'group relative rounded-lg mb-1 transition-all duration-150',
        isActive
          // 选中态：左侧品牌色竖条 + 10%透明度背景
          ? 'bg-primary-500/10 border-l-[3px] border-l-primary-500'
          : 'hover:bg-secondary-800/70'
      )}
    >
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 p-3 pr-10 text-left"
      >
        {session.pinned && (
          <Star className="w-4 h-4 text-warning shrink-0 fill-warning" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {session.title}
          </p>
          <p className="text-xs text-secondary-400">
            {session.lastMessageAt
              ? formatRelativeTime(session.lastMessageAt)
              : session.updatedAt
              ? formatRelativeTime(session.updatedAt)
              : session.createdAt
              ? formatRelativeTime(session.createdAt)
              : ''}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-secondary-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Context Menu Button - 悬停时显示 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-secondary-400 hover:text-white
                   opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-secondary-700 rounded"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {showMenu && (
        <div className="absolute right-2 top-full mt-1 w-36 bg-secondary-800 rounded-lg shadow-xl z-10 py-1 border border-secondary-700">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPin()
              setShowMenu(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-secondary-700"
          >
            <Star className="w-4 h-4" />
            {session.pinned ? '取消收藏' : '收藏'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onArchive()
              setShowMenu(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-secondary-700"
          >
            <Archive className="w-4 h-4" />
            {session.archived ? '取消归档' : '归档'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
              setShowMenu(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-secondary-700"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      )}
    </div>
  )
}
