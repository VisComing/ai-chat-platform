'use client'

import { cn } from '@/lib/utils'
import { Button, SessionItemSkeleton } from '@/components/ui'
import { useSessionStore } from '@/stores/sessionStore'
import {
  Menu,
  Plus,
  Settings,
  Star,
  Archive,
  Trash2,
  MoreHorizontal,
  Bot,
  X,
  ChevronDown,
  LogOut,
  HelpCircle,
  Moon,
  Sun,
  User,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { researchTaskService, ResearchTaskListItem } from '@/services/researchTaskService'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  onNewChat: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteCurrentSession?: () => void
  onSelectResearchTask?: (taskId: string) => void
}

// 智能时间格式化
function formatSmartTime(date: Date | string | undefined): string {
  if (!date) return ''

  let d: Date
  if (typeof date === 'string') {
    d = date.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(date)
      ? new Date(date)
      : new Date(date + 'Z')
  } else {
    d = new Date(date)
  }

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffDays === 0) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[d.getDay()]
  }
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// 获取分组标签
function getGroupLabel(date: Date | string | undefined): string {
  if (!date) return '更早'

  let d: Date
  if (typeof date === 'string') {
    d = date.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(date)
      ? new Date(date)
      : new Date(date + 'Z')
  } else {
    d = new Date(date)
  }

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return '7天内'
  return '更早'
}

// Helper to parse UTC date string
function parseUTCDate(date: Date | string | undefined): number {
  if (!date) return 0
  if (typeof date === 'string') {
    const d = date.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(date)
      ? new Date(date)
      : new Date(date + 'Z')
    return d.getTime()
  }
  return new Date(date).getTime()
}

// 按分组组织会话
function groupSessions(sessions: Array<{
  id: string
  title: string
  pinned: boolean
  archived: boolean
  lastMessageAt?: Date | string
  updatedAt?: Date | string
  createdAt?: Date | string
}>): { label: string; sessions: typeof sessions }[] {
  const groups: { label: string; sessions: typeof sessions }[] = []

  const pinnedSessions = sessions.filter(s => s.pinned)
  if (pinnedSessions.length > 0) {
    groups.push({ label: '置顶', sessions: pinnedSessions })
  }

  const unpinnedSessions = sessions.filter(s => !s.pinned)
  const todaySessions = unpinnedSessions.filter(s => getGroupLabel(s.lastMessageAt || s.createdAt) === '今天')
  const yesterdaySessions = unpinnedSessions.filter(s => getGroupLabel(s.lastMessageAt || s.createdAt) === '昨天')
  const weekSessions = unpinnedSessions.filter(s => getGroupLabel(s.lastMessageAt || s.createdAt) === '7天内')
  const olderSessions = unpinnedSessions.filter(s => getGroupLabel(s.lastMessageAt || s.createdAt) === '更早')

  if (todaySessions.length > 0) groups.push({ label: '今天', sessions: todaySessions })
  if (yesterdaySessions.length > 0) groups.push({ label: '昨天', sessions: yesterdaySessions })
  if (weekSessions.length > 0) groups.push({ label: '7天内', sessions: weekSessions })
  if (olderSessions.length > 0) groups.push({ label: '更早', sessions: olderSessions })

  return groups
}

export function Sidebar({ isOpen, onToggle, onNewChat, onSelectSession, onDeleteCurrentSession, onSelectResearchTask }: SidebarProps) {
  const {
    sessions,
    currentSessionId,
    deleteSession,
    pinSession,
    archiveSession,
    isLoading,
  } = useSessionStore()

  const [activeTab, setActiveTab] = useState<'chat' | 'favorites' | 'archive' | 'research'>('chat')
  const [searchQuery, setSearchQuery] = useState('')

  // 深度研究任务列表状态
  const [researchTasks, setResearchTasks] = useState<ResearchTaskListItem[]>([])
  const [researchLoading, setResearchLoading] = useState(false)

  // Filter sessions based on active tab and search
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase())

    if (activeTab === 'chat') return !session.archived && matchesSearch
    if (activeTab === 'favorites') return session.pinned && !session.archived && matchesSearch
    if (activeTab === 'archive') return session.archived && matchesSearch
    return true
  })

  // Sort: pinned first, then by last message time
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    const dateA = parseUTCDate(a.lastMessageAt) || parseUTCDate(a.createdAt)
    const dateB = parseUTCDate(b.lastMessageAt) || parseUTCDate(b.createdAt)
    return dateB - dateA
  })

  const sessionGroups = groupSessions(sortedSessions)

  // 加载深度研究任务列表
  useEffect(() => {
    if (activeTab === 'research') {
      loadResearchTasks()
    }
  }, [activeTab])

  const loadResearchTasks = async () => {
    setResearchLoading(true)
    try {
      const tasks = await researchTaskService.listTasks({ limit: 50 })
      setResearchTasks(tasks)
    } catch (error) {
      console.error('加载研究任务失败:', error)
    } finally {
      setResearchLoading(false)
    }
  }

  // 获取研究任务状态颜色
  const getResearchStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500'
      case 'running': return 'text-blue-500'
      case 'paused': return 'text-amber-500'
      case 'failed': return 'text-red-500'
      case 'cancelled': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  // 获取研究任务状态文本
  const getResearchStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成'
      case 'running': return '进行中'
      case 'paused': return '等待澄清'
      case 'pending': return '排队中'
      case 'failed': return '失败'
      case 'cancelled': return '已取消'
      default: return status
    }
  }

  return (
    <>
      {/* Mobile Sidebar Toggle Button - 只在侧边栏收起时显示 */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 p-2.5 bg-[#1a1a2e] text-white hover:bg-[#252542] rounded-lg shadow-lg transition-colors lg:hidden"
          aria-label="展开侧边栏"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'h-screen bg-[#1a1a2e] text-white flex flex-col transition-all duration-300',
          // 桌面端：固定侧边栏
          'lg:relative lg:transition-[width]',
          isOpen ? 'lg:w-64' : 'lg:w-0 lg:overflow-hidden',
          // 移动端：固定宽度侧边栏（不占满全屏）
          'fixed left-0 top-0 z-50 h-full',
          isOpen ? 'w-[280px] max-w-[85vw] translate-x-0' : 'w-0 -translate-x-full overflow-hidden'
        )}
      >
        {/* Header - 品牌区极简设计 */}
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 单色蓝 Logo */}
            <div className="w-10 h-10 rounded-[10px] bg-[#3b82f6] flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="font-semibold text-base text-[#f8fafc]">AI助手</span>
          </div>
          {/* 关闭按钮 - 移动端显示 X，桌面端显示菜单图标 */}
          <button
            onClick={onToggle}
            className="p-2 text-[#94a3b8] hover:text-white rounded-lg transition-colors"
            title="收起侧边栏"
          >
            <X className="w-5 h-5 lg:hidden" />
            <Menu className="w-5 h-5 hidden lg:block" />
          </button>
        </div>

        {/* New Chat Button - 极简白描风格 */}
        <div className="px-4 py-3">
          <button
            onClick={onNewChat}
            className="w-full h-11 flex items-center justify-center gap-2
                       bg-transparent border border-white/[0.15] rounded-[20px]
                       text-white text-sm font-medium
                       hover:bg-white/[0.05] hover:border-white/[0.25]
                       transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>新对话</span>
          </button>
        </div>

        {/* Search - 极简透明样式 */}
        <div className="px-4 pb-3">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2.5 bg-transparent text-white text-sm
                         placeholder:text-[#64748b] placeholder:text-left
                         border-b border-white/[0.1]
                         focus:outline-none focus:border-[#3b82f6]
                         transition-colors duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-[#64748b] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs - 文字导航 + 底部蓝线指示器 */}
        <div className="px-4 pb-3 flex gap-6">
          {[
            { id: 'chat', label: '对话' },
            { id: 'favorites', label: '收藏' },
            { id: 'archive', label: '归档' },
            { id: 'research', label: '研究' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={cn(
                'relative py-2 text-sm transition-colors duration-200',
                activeTab === id ? 'text-white' : 'text-[#94a3b8] hover:text-white'
              )}
            >
              <span>{label}</span>
              {activeTab === id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3b82f6] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Session List / Research List */}
        <div className="flex-1 overflow-y-auto px-2">
          {activeTab === 'research' ? (
            // 深度研究任务列表
            researchLoading ? (
              <div key="research-loading" className="p-4 text-center text-[#64748b] text-sm">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                加载中...
              </div>
            ) : researchTasks.length === 0 ? (
              <div key="research-empty" className="p-4 text-center text-[#64748b] text-sm">
                暂无深度研究任务
              </div>
            ) : (
              researchTasks.map((task, index) => (
                <div
                  key={task.taskId || `research-task-${index}`}
                  className="group relative h-16 hover:bg-white/[0.03] rounded-lg mx-1 transition-all duration-200"
                >
                  <button
                    onClick={() => {
                      if (onSelectResearchTask) {
                        onSelectResearchTask(task.taskId)
                      }
                    }}
                    className="w-full h-full flex items-center gap-3 px-4 text-left"
                  >
                    <Sparkles className={cn('w-4 h-4 shrink-0', getResearchStatusColor(task.status))} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {task.query}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#64748b]">
                        <span className={getResearchStatusColor(task.status)}>
                          {getResearchStatusText(task.status)}
                        </span>
                        <span>·</span>
                        <span>{formatSmartTime(task.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                </div>
              ))
            )
          ) : isLoading ? (
            <div key="sessions-loading">
              <SessionItemSkeleton />
              <SessionItemSkeleton />
              <SessionItemSkeleton />
            </div>
          ) : sessionGroups.length === 0 ? (
            <div key="sessions-empty" className="p-4 text-center text-[#64748b] text-sm">
              {searchQuery ? '没有找到匹配的对话' : '暂无对话'}
            </div>
          ) : (
            sessionGroups.map((group) => (
              <div key={group.label}>
                {/* Group Header */}
                <div className="px-4 py-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                  {group.label}
                </div>
                {/* Group Items */}
                {group.sessions.map((session) => (
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
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer - 用户功能区 */}
        <div className="h-14 px-4 border-t border-white/[0.08]">
          <UserMenu />
        </div>
      </aside>

      {/* Mobile Overlay - 点击遮罩关闭侧边栏 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
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
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    }
    setShowMenu(false)
  }

  return (
    <div className="relative h-full flex items-center">
      {/* User Avatar Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center gap-3 h-10 rounded-lg hover:bg-white/[0.05] transition-colors"
      >
        {/* 头像：品牌蓝背景 + 白色首字母 */}
        <div className="w-9 h-9 rounded-full bg-[#3b82f6] flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-white flex-1">用户</span>
        <MoreHorizontal className="w-5 h-5 text-[#94a3b8]" />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#252542] rounded-lg shadow-xl border border-white/[0.08] py-1 z-10">
          <button
            onClick={() => setShowMenu(false)}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/[0.05]"
          >
            <Settings className="w-4 h-4" />
            个人设置
          </button>

          {/* Theme Submenu */}
          <div className="border-t border-white/[0.08] mt-1 pt-1">
            <div className="px-4 py-1 text-xs text-[#64748b]">主题</div>
            {[
              { id: 'light', icon: Sun, label: '浅色' },
              { id: 'dark', icon: Moon, label: '深色' },
              { id: 'system', icon: Settings, label: '跟随系统' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => handleThemeChange(id as typeof theme)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/[0.05]',
                  theme === id ? 'text-[#60a5fa]' : 'text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {theme === id && <span className="ml-auto text-[#60a5fa]">✓</span>}
              </button>
            ))}
          </div>

          <div className="border-t border-white/[0.08] mt-1 pt-1">
            <button
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/[0.05]"
            >
              <HelpCircle className="w-4 h-4" />
              帮助中心
            </button>
            <button
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/[0.05]"
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
    lastMessageAt?: Date | string
    updatedAt?: Date | string
    createdAt?: Date | string
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
        'group relative h-14 transition-all duration-200',
        isActive
          ? 'bg-[#3b82f6]/12 rounded-xl mx-1' // 选中态：淡蓝背景 + 圆角
          : 'hover:bg-white/[0.03] rounded-lg mx-1'
      )}
    >
      <button
        onClick={onClick}
        className="w-full h-full flex items-center gap-2 px-4 text-left"
      >
        {session.pinned && (
          <Star className="w-4 h-4 text-yellow-500 shrink-0 fill-yellow-500" />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium truncate',
            isActive ? 'text-[#60a5fa]' : 'text-white'
          )}>
            {session.title}
          </p>
          <p className="text-xs text-[#64748b]">
            {formatSmartTime(session.lastMessageAt || session.updatedAt || session.createdAt)}
          </p>
        </div>
      </button>

      {/* Context Menu Button - 悬停时显示 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2 p-1.5',
          'text-[#64748b] hover:text-white hover:bg-white/[0.08] rounded',
          'opacity-0 group-hover:opacity-100 transition-opacity z-10'
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {showMenu && (
        <div className="absolute right-2 top-full mt-1 w-36 bg-[#252542] rounded-lg shadow-xl z-10 py-1 border border-white/[0.08]">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPin()
              setShowMenu(false)
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/[0.05]"
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
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/[0.05]"
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
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/[0.05]"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      )}
    </div>
  )
}