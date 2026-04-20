import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@/types'
import { sessionService } from '@/services/sessionService'
import { generateId } from '@/lib/utils'

interface SessionState {
  sessions: Session[]
  currentSessionId: string | null
  isLoading: boolean
  error: string | null
  isInitialized: boolean

  // Actions
  init: () => Promise<void>
  createSession: (title?: string) => Promise<Session>
  selectSession: (sessionId: string | null) => void
  updateSession: (sessionId: string, updates: Partial<Session>) => void
  updateSessionTitle: (sessionId: string, title: string) => void
  deleteSession: (sessionId: string) => Promise<void>
  archiveSession: (sessionId: string) => void
  pinSession: (sessionId: string) => void
  loadSessions: () => Promise<void>
  getCurrentSession: () => Session | null
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      isLoading: false,
      error: null,
      isInitialized: false,

      init: async () => {
        const { isInitialized, loadSessions } = get()
        if (isInitialized) return
        
        set({ isLoading: true })
        try {
          await loadSessions()
          set({ isInitialized: true, isLoading: false })
        } catch (error) {
          set({ isLoading: false, error: error instanceof Error ? error.message : '初始化失败' })
        }
      },

      createSession: async (title?: string) => {
        // Don't set isLoading: true - this causes skeleton flash in sidebar
        set({ error: null })

        try {
          // Create session on backend first
          const savedSession = await sessionService.create({
            title: title || '新对话',
          })

          // Add to local state
          set((state) => ({
            sessions: [savedSession, ...state.sessions],
            currentSessionId: savedSession.id,
          }))

          return savedSession
        } catch (error) {
          // Fallback to local session if backend fails
          const localSession: Session = {
            id: generateId(),
            userId: 'local',
            title: title || '新对话',
            pinned: false,
            archived: false,
            messageCount: 0,
            createdAt: new Date(),
          }

          set((state) => ({
            sessions: [localSession, ...state.sessions],
            currentSessionId: localSession.id,
          }))

          return localSession
        }
      },

      selectSession: (sessionId: string | null) => {
        if (sessionId === null) {
          // Allow clearing selection
          set({ currentSessionId: null })
          return
        }
        const { sessions } = get()
        // Verify session exists
        const session = sessions.find(s => s.id === sessionId)
        if (session) {
          set({ currentSessionId: sessionId })
        }
      },

      updateSession: async (sessionId: string, updates: Partial<Session>) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, ...updates, updatedAt: new Date() } : s
          ),
        }))

        // Sync with backend
        try {
          await sessionService.update(sessionId, updates)
        } catch (error) {
          console.error('Failed to update session on server:', error)
        }
      },

      updateSessionTitle: (sessionId: string, title: string) => {
        console.log('[SessionStore] Updating session title:', sessionId, '->', title)
        // Update title locally (no backend sync needed, title already updated by backend)
        set((state) => {
          const sessions = state.sessions.map((s) =>
            s.id === sessionId ? { ...s, title, updatedAt: new Date() } : s
          )
          console.log('[SessionStore] Updated sessions:', sessions.map(s => ({ id: s.id, title: s.title })))
          return { sessions }
        })
      },

      deleteSession: async (sessionId: string) => {
        const { currentSessionId } = get()

        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          currentSessionId:
            currentSessionId === sessionId ? null : currentSessionId,
        }))

        try {
          await sessionService.delete(sessionId)
        } catch (error) {
          console.error('Failed to delete session from server:', error)
        }
      },

      archiveSession: async (sessionId: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, archived: true } : s
          ),
        }))

        try {
          await sessionService.archive(sessionId)
        } catch (error) {
          console.error('Failed to archive session:', error)
        }
      },

      pinSession: async (sessionId: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, pinned: !s.pinned } : s
          ),
        }))

        try {
          await sessionService.pin(sessionId)
        } catch (error) {
          console.error('Failed to pin session:', error)
        }
      },

      loadSessions: async () => {
        set({ isLoading: true, error: null })

        try {
          const sessions = await sessionService.list()
          set({
            sessions,
            isLoading: false,
            isInitialized: true,  // 标记初始化完成
          })
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '加载失败',
          })
        }
      },

      getCurrentSession: () => {
        const { sessions, currentSessionId } = get()
        return sessions.find((s) => s.id === currentSessionId) || null
      },
    }),
    {
      name: 'session-storage',
      // Don't persist anything - always load fresh from backend
      partialize: () => ({}),
    }
  )
)

// Selector hook for current session
export function useCurrentSession() {
  const sessions = useSessionStore((state) => state.sessions)
  const currentSessionId = useSessionStore((state) => state.currentSessionId)
  
  if (!currentSessionId) return null
  return sessions.find((s) => s.id === currentSessionId) || null
}