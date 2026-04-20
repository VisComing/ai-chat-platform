'use client'

import { ChatContainer } from '@/components/chat'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useSessionStore, useCurrentSession } from '@/stores/sessionStore'
import { useAuthStore, autoLoginTestUser, checkAuth } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { toast } from '@/components/ui'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

// 骨架屏组件 - 服务端和客户端渲染一致
function SkeletonLayout() {
  return (
    <div className="h-screen flex bg-white dark:bg-secondary-900">
      {/* Sidebar skeleton - 固定宽度，避免 hydration 不匹配 */}
      <div className="w-64 bg-secondary-50 dark:bg-secondary-800 border-r border-secondary-200 dark:border-secondary-700">
        <div className="p-4 space-y-4">
          <div className="h-8 bg-secondary-200 dark:bg-secondary-700 rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-secondary-200 dark:bg-secondary-700 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-secondary-50 dark:bg-secondary-800 border-b border-secondary-200 dark:border-secondary-700 flex items-center px-4">
          <div className="h-6 w-32 bg-secondary-200 dark:bg-secondary-700 rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    </div>
  )
}

// 全屏 loading 组件 - 服务端和客户端渲染一致
function FullScreenLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-white dark:bg-secondary-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-secondary-600 dark:text-secondary-400">正在初始化...</p>
      </div>
    </div>
  )
}

export function ChatLayout() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true) // 默认打开，避免 hydration 不匹配

  // 初始化状态 - 客户端首次渲染后再检查 localStorage
  const [isInitializing, setIsInitializing] = useState(true)
  const [hasStoredToken, setHasStoredToken] = useState(false)

  // 客户端首次渲染后检查 localStorage 和屏幕宽度
  useEffect(() => {
    // 检查是否有缓存的 token
    try {
      const stored = localStorage.getItem('auth-storage')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.state?.accessToken) {
          setHasStoredToken(true)
        }
      }
    } catch {}

    // 检测屏幕宽度
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [])
  const currentSession = useCurrentSession()
  const { createSession, selectSession, sessions, init: initSessions } = useSessionStore()
  const { isAuthenticated } = useAuthStore()
  const setOnSessionCreated = useChatStore.getState().setOnSessionCreated

  // Track if this is the first load (to read from URL)
  const isInitialLoad = useRef(true)

  // Set up callback for when a new session is created during chat
  useEffect(() => {
    setOnSessionCreated((newSessionId: string) => {
      // Update URL without triggering navigation
      window.history.pushState(null, '', `/chat/${newSessionId}`)
    })

    return () => {
      setOnSessionCreated(() => {})
    }
  }, [setOnSessionCreated])

  // Initialize auth and sessions - 并行优化
  useEffect(() => {
    const init = async () => {
      try {
        // 先检查 store 中是否有 token（刚登录的情况）
        let storeToken = useAuthStore.getState().accessToken

        // 如果 store 中没有，再从 localStorage 读取
        let storedToken: string | null = storeToken || null
        if (!storedToken) {
          try {
            const stored = localStorage.getItem('auth-storage')
            if (stored) {
              const parsed = JSON.parse(stored)
              storedToken = parsed?.state?.accessToken || null
            }
          } catch {}
        }

        if (storedToken) {
          // 有缓存 token：并行执行认证验证和会话加载
          // 使用 allSettled 防止会话加载失败阻塞认证
          const [authResult] = await Promise.allSettled([
            checkAuth(),
            initSessions()
          ])

          const isAuthed = authResult.status === 'fulfilled' && authResult.value

          if (!isAuthed) {
            // 认证失败，尝试自动登录
            const autoLoginSuccess = await autoLoginTestUser()
            if (!autoLoginSuccess) {
              router.push('/login')
              return
            }
            // 登录成功后重新加载会话
            await initSessions()
          }
        } else {
          // 无缓存 token：先认证，再加载会话（串行）
          const autoLoginSuccess = await autoLoginTestUser()
          if (!autoLoginSuccess) {
            router.push('/login')
            return
          }
          await initSessions()
        }

        // Get sessionId from URL on first load
        const urlSessionId = window.location.pathname.match(/\/chat\/([^/]+)/)?.[1]

        if (urlSessionId) {
          // Check if session exists in the loaded sessions
          const sessionExists = useSessionStore.getState().sessions.some(s => s.id === urlSessionId)

          if (sessionExists) {
            // Load the specific session from URL
            selectSession(urlSessionId)
            useChatStore.getState().setCurrentSession(urlSessionId)
            try {
              await useChatStore.getState().loadMessages(urlSessionId)
            } catch (e) {
              console.log('No messages for session:', urlSessionId)
            }
          } else {
            // Session not found - show error and go to start page
            toast.error('该会话不存在或已被删除')
            window.history.replaceState(null, '', '/')
          }
        }
        // If no session in URL (root path), stay on start page
      } catch (error) {
        console.error('Initialization error:', error)
      } finally {
        setIsInitializing(false)
        isInitialLoad.current = false
      }
    }
    init()
  }, [router, initSessions, selectSession])

  // Handle new chat - clear current session and show start page
  const handleNewChat = useCallback(async () => {
    // Clear current session - don't create new session yet
    // Session will be created when user sends first message
    useSessionStore.getState().selectSession(null) // Clear selection
    useChatStore.getState().setCurrentSession(null)
    useChatStore.getState().clearMessages()
    // Update URL to root path (shows start page)
    window.history.pushState(null, '', '/')
  }, [])

  // Handle session selection - update state and URL
  const handleSelectSession = useCallback(async (sessionId: string) => {
    // Don't reload if already on this session
    if (sessionId === useSessionStore.getState().currentSessionId) return

    selectSession(sessionId)
    useChatStore.getState().setCurrentSession(sessionId)

    // Load messages for this session
    try {
      await useChatStore.getState().loadMessages(sessionId)
    } catch (e) {
      console.log('No messages for session:', sessionId)
    }

    // Update URL without triggering page reload
    window.history.pushState(null, '', `/chat/${sessionId}`)
  }, [selectSession])

  // Handle delete current session - clear chat and select another session or go to empty state
  const handleDeleteCurrentSession = useCallback(async () => {
    // Clear current messages
    useChatStore.getState().clearMessages()
    useChatStore.getState().setCurrentSession(null)

    // Get remaining sessions (after delete, sessions are already updated)
    const { sessions: remainingSessions, selectSession: selectNewSession } = useSessionStore.getState()

    if (remainingSessions.length > 0) {
      // Select the first remaining session
      const nextSession = remainingSessions[0]
      selectNewSession(nextSession.id)
      useChatStore.getState().setCurrentSession(nextSession.id)
      try {
        await useChatStore.getState().loadMessages(nextSession.id)
      } catch (e) {
        console.log('No messages for session:', nextSession.id)
      }
      window.history.pushState(null, '', `/chat/${nextSession.id}`)
    } else {
      // No sessions left - go to root path (will show empty state)
      window.history.pushState(null, '', '/')
    }
  }, [])

  // 如果有缓存 token 且正在初始化，显示骨架屏
  if (isInitializing && hasStoredToken) {
    return <SkeletonLayout />
  }

  // 无缓存 token 时显示全屏 loading
  if (isInitializing) {
    return <FullScreenLoading />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="h-screen flex bg-white dark:bg-secondary-900">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteCurrentSession={handleDeleteCurrentSession}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title={currentSession?.title || '新对话'}
        />

        {/* Chat Area */}
        <ChatContainer className="flex-1 flex flex-col" />
      </div>
    </div>
  )
}