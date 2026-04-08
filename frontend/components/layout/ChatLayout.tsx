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

export function ChatLayout() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false) // 移动端默认收起
  const [isInitializing, setIsInitializing] = useState(true)

  // 检测屏幕宽度，桌面端自动展开侧边栏
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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

  // Initialize auth and sessions
  useEffect(() => {
    const init = async () => {
      try {
        // Check if already authenticated
        const isAuthed = await checkAuth()

        if (!isAuthed) {
          // Try auto-login test user in test mode
          const autoLoginSuccess = await autoLoginTestUser()

          if (!autoLoginSuccess) {
            router.push('/login')
            return
          }
        }

        // Initialize session store (load from database)
        await initSessions()

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
        // Don't auto-load or create session - wait for user to send message
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

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-secondary-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-secondary-600 dark:text-secondary-400">正在初始化...</p>
        </div>
      </div>
    )
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