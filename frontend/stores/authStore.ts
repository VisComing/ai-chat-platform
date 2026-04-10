import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, AuthState } from '@/types'
import { authService } from '@/services/authService'

interface AuthStore extends AuthState {
  login: (account: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  setUser: (user: User, accessToken: string, refreshToken: string) => void
  checkAndRefreshToken: () => Promise<boolean>
}

// Parse JWT to get expiry time
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null // Convert to milliseconds
  } catch {
    return null
  }
}

// Check if token is about to expire (within 5 minutes)
function isTokenExpiringSoon(token: string): boolean {
  const expiry = getTokenExpiry(token)
  if (!expiry) return true // If we can't parse, assume expired
  return Date.now() > expiry - 5 * 60 * 1000 // 5 minutes before expiry
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (account: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await authService.login(account, password)
          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (email: string, username: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await authService.register({ email, username, password })
          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await authService.logout()
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
        }
      },

      refreshAuth: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return

        try {
          const response = await authService.refreshToken(refreshToken)
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          })
        } catch {
          // Refresh failed, logout
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
        }
      },

      setUser: (user: User, accessToken: string, refreshToken: string) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        })
      },

      checkAndRefreshToken: async () => {
        const { accessToken, refreshToken, isAuthenticated } = get()

        if (!isAuthenticated || !accessToken) {
          return false
        }

        // Check if token needs refresh
        if (isTokenExpiringSoon(accessToken)) {
          if (refreshToken) {
            try {
              await get().refreshAuth()
              return true
            } catch {
              // Refresh failed, logout
              await get().logout()
              return false
            }
          } else {
            // No refresh token, logout
            await get().logout()
            return false
          }
        }

        return true
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        // Don't persist user - load from API on refresh
      }),
    }
  )
)

// Test user credentials
const TEST_USER = process.env.NEXT_PUBLIC_TEST_USER || 'testuser'
const TEST_PASS = process.env.NEXT_PUBLIC_TEST_PASS || 'testpass123'
const TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === 'true'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'

// Auto-login test user in test mode
export async function autoLoginTestUser(): Promise<boolean> {
  const { isAuthenticated, accessToken } = useAuthStore.getState()

  if (isAuthenticated && accessToken) {
    // Verify token is still valid
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })
      if (response.ok) {
        return true // Token is valid
      }
    } catch {
      // Token invalid
    }
  }

  // Auto-login test user in test mode
  if (TEST_MODE) {
    try {
      await useAuthStore.getState().login(TEST_USER, TEST_PASS)
      console.log('[Auth] Auto-logged in as test user')
      return true
    } catch (error) {
      console.error('[Auth] Auto-login failed:', error)
    }
  }

  return false
}

// Check if user is authenticated
export async function checkAuth(): Promise<boolean> {
  // 先尝试从 localStorage 直接读取（处理 SSR hydration 问题）
  let accessToken = useAuthStore.getState().accessToken

  if (!accessToken) {
    try {
      const stored = localStorage.getItem('auth-storage')
      if (stored) {
        const parsed = JSON.parse(stored)
        accessToken = parsed?.state?.accessToken
        // 如果 localStorage 有 token，同步到 store
        if (accessToken) {
          useAuthStore.setState({
            accessToken,
            refreshToken: parsed?.state?.refreshToken,
          })
        }
      }
    } catch (e) {
      console.error('[Auth] Failed to read localStorage:', e)
    }
  }

  if (!accessToken) return false

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    if (response.ok) {
      const data = await response.json()
      useAuthStore.getState().setUser(
        data.data,
        accessToken,
        useAuthStore.getState().refreshToken || ''
      )
      return true
    }
  } catch {
    // Token invalid
  }

  useAuthStore.getState().logout()
  return false
}