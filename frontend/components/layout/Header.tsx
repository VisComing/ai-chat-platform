'use client'

import { Button, Avatar } from '@/components/ui'
import { Menu, Share2, MoreHorizontal, Pencil, Sun, Moon, Monitor } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  onToggleSidebar: () => void
  title: string
  onTitleChange?: (title: string) => void
}

export function Header({ onToggleSidebar, title, onTitleChange }: HeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(title)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  const handleTitleSubmit = () => {
    setIsEditing(false)
    if (editedTitle.trim() && editedTitle !== title) {
      onTitleChange?.(editedTitle.trim())
    } else {
      setEditedTitle(title)
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    // Apply theme
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    } else if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <header className="h-14 border-b border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 flex items-center justify-between px-3 sm:px-4">
      {/* Left Section */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Sidebar Toggle Button - 移动端在侧边栏收起时不显示（由Sidebar组件自己控制） */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="hidden lg:flex"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Title */}
        {isEditing ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit()
              if (e.key === 'Escape') {
                setEditedTitle(title)
                setIsEditing(false)
              }
            }}
            autoFocus
            className="text-base sm:text-lg font-semibold bg-transparent border-b-2 border-primary-500 outline-none px-1 flex-1 min-w-0"
          />
        ) : (
          <button
            onClick={() => {
              setEditedTitle(title)
              setIsEditing(true)
            }}
            className="group flex items-center gap-1 sm:gap-2 text-base sm:text-lg font-semibold text-secondary-900 dark:text-white hover:text-primary-500 transition-colors truncate"
          >
            <span className="truncate">{title}</span>
            <Pencil className="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 shrink-0" />
          </button>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Theme Toggle - 移动端隐藏，使用下拉菜单 */}
        <div className="hidden sm:flex items-center bg-secondary-100 dark:bg-secondary-800 rounded-lg p-1">
          {[
            { id: 'light', icon: Sun, label: '浅色' },
            { id: 'dark', icon: Moon, label: '深色' },
            { id: 'system', icon: Monitor, label: '系统' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleThemeChange(id as typeof theme)}
              className={`p-1.5 rounded transition-colors ${
                theme === id
                  ? 'bg-white dark:bg-secondary-700 text-primary-500 shadow-sm'
                  : 'text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300'
              }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Mobile Theme Menu Button */}
        <button
          onClick={() => {
            const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
            handleThemeChange(nextTheme)
          }}
          className="sm:hidden p-2 text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300 rounded-lg transition-colors"
          title="切换主题"
        >
          {theme === 'light' ? <Sun className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Share - 移动端隐藏 */}
        <Button variant="ghost" size="icon" title="分享" className="hidden sm:flex">
          <Share2 className="w-5 h-5" />
        </Button>

        {/* More Options */}
        <Button variant="ghost" size="icon" title="更多">
          <MoreHorizontal className="w-5 h-5" />
        </Button>

        {/* User Avatar */}
        <Avatar
          src={undefined}
          alt="用户"
          fallback="U"
          size="sm"
          className="ml-1 sm:ml-2 cursor-pointer"
        />
      </div>
    </header>
  )
}
