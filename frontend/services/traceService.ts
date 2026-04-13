import { apiClient } from './apiClient'
import { useAuthStore } from '@/stores/authStore'

interface Trace {
  id: string
  session_id: string
  message_id: string
  model: string
  api_provider: string
  duration_ms: number
  token_input: number | null
  token_output: number | null
  status: string
  created_at: string
}

interface TraceDetail extends Trace {
  user_id: string
  request_messages: Array<{ role: string; content: string }>
  request_params: {
    temperature?: number
    max_tokens?: number
  }
  response_content: string
  response_reasoning?: string
  error_message?: string
  tool_calls?: Array<{ name: string; args: Record<string, unknown> }>
}

interface ListTracesParams {
  page?: number
  limit?: number
  session_id?: string
  model?: string
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

class TraceService {
  private getHeaders(): Record<string, string> {
    const token = useAuthStore.getState().accessToken
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async list(params?: ListTracesParams): Promise<{ data: Trace[]; total: number; hasMore: boolean }> {
    const queryParams = new URLSearchParams()

    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.limit) queryParams.set('limit', params.limit.toString())
    if (params?.session_id) queryParams.set('session_id', params.session_id)
    if (params?.model) queryParams.set('model', params.model)

    const query = queryParams.toString()
    const endpoint = `/traces${query ? `?${query}` : ''}`

    const response = await apiClient.get<PaginatedResponse<Trace>>(endpoint, {
      headers: this.getHeaders(),
    })
    return {
      data: response.data.data,
      total: response.data.total,
      hasMore: response.data.hasMore,
    }
  }

  async getSessionTraces(sessionId: string): Promise<Trace[]> {
    const response = await apiClient.get<{ success: boolean; data: Trace[] }>(
      `/traces/session/${sessionId}`,
      { headers: this.getHeaders() }
    )
    return response.data
  }

  async get(traceId: string): Promise<TraceDetail> {
    const response = await apiClient.get<{ success: boolean; data: TraceDetail }>(
      `/traces/${traceId}`,
      { headers: this.getHeaders() }
    )
    return response.data
  }
}

export const traceService = new TraceService()
export type { Trace, TraceDetail }