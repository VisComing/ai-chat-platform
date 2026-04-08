import { apiClient } from './apiClient'
import { useAuthStore } from '@/stores/authStore'
import type { Session } from '@/types'

interface CreateSessionRequest {
  title?: string
  systemPrompt?: string
  defaultModel?: string
}

interface UpdateSessionRequest {
  title?: string
  systemPrompt?: string
  defaultModel?: string
  pinned?: boolean
}

interface ListSessionsParams {
  page?: number
  limit?: number
  archived?: boolean
  pinned?: boolean
  search?: string
}

interface PaginatedResponse<T> {
  success: boolean
  data: {
    data: T[]
    total: number
    page: number
    limit: number
    hasMore: boolean
  }
}

class SessionService {
  private getHeaders(): Record<string, string> {
    const token = useAuthStore.getState().accessToken
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async list(params?: ListSessionsParams): Promise<Session[]> {
    const queryParams = new URLSearchParams()
    
    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.limit) queryParams.set('limit', params.limit.toString())
    if (params?.archived !== undefined) queryParams.set('archived', params.archived.toString())
    if (params?.pinned !== undefined) queryParams.set('pinned', params.pinned.toString())
    if (params?.search) queryParams.set('search', params.search)

    const query = queryParams.toString()
    const endpoint = `/sessions${query ? `?${query}` : ''}`
    
    const response = await apiClient.get<PaginatedResponse<Session>>(endpoint, {
      headers: this.getHeaders(),
    })
    return response.data.data
  }

  async get(sessionId: string): Promise<Session> {
    const response = await apiClient.get<{ success: boolean; data: Session }>(`/sessions/${sessionId}`, {
      headers: this.getHeaders(),
    })
    return response.data
  }

  async create(request: CreateSessionRequest): Promise<Session> {
    const response = await apiClient.post<{ success: boolean; data: Session }>('/sessions', request, {
      headers: this.getHeaders(),
    })
    return response.data
  }

  async update(sessionId: string, request: UpdateSessionRequest): Promise<Session> {
    const response = await apiClient.patch<{ success: boolean; data: Session }>(`/sessions/${sessionId}`, request, {
      headers: this.getHeaders(),
    })
    return response.data
  }

  async delete(sessionId: string): Promise<void> {
    await apiClient.delete(`/sessions/${sessionId}`, {
      headers: this.getHeaders(),
    })
  }

  async archive(sessionId: string): Promise<void> {
    await apiClient.post(`/sessions/${sessionId}/archive`, {}, {
      headers: this.getHeaders(),
    })
  }

  async unarchive(sessionId: string): Promise<void> {
    await apiClient.post(`/sessions/${sessionId}/unarchive`, {}, {
      headers: this.getHeaders(),
    })
  }

  async pin(sessionId: string): Promise<void> {
    await apiClient.post(`/sessions/${sessionId}/pin`, {}, {
      headers: this.getHeaders(),
    })
  }

  async unpin(sessionId: string): Promise<void> {
    await apiClient.post(`/sessions/${sessionId}/unpin`, {}, {
      headers: this.getHeaders(),
    })
  }
}

export const sessionService = new SessionService()