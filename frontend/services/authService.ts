import { apiClient } from './apiClient'
import type { User } from '@/types'

interface LoginRequest {
  account: string  // Can be email or username
  password: string
}

interface RegisterRequest {
  email: string
  username: string
  password: string
}

interface AuthResponse {
  success: boolean
  data: {
    user: User
    accessToken: string
    refreshToken: string
  }
}

class AuthService {
  async login(account: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const response = await apiClient.post<AuthResponse>('/auth/login', { account, password })
    return response.data
  }

  async register(request: RegisterRequest): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const response = await apiClient.post<AuthResponse>('/auth/register', request)
    return response.data
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout', {})
    } catch {
      // Ignore logout errors
    }
  }

  async refreshToken(refreshToken: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const response = await apiClient.post<AuthResponse>('/auth/refresh', { refreshToken })
    return response.data
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ success: boolean; data: User }>('/auth/me')
    return response.data
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.patch<{ success: boolean; data: User }>('/users/me', data)
    return response.data
  }
}

export const authService = new AuthService()