// API Client Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'
const DEFAULT_TIMEOUT = 30000 // 30 seconds

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  timeout?: number
  skipAuthRefresh?: boolean
}

class ApiClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>

  constructor(baseURL: string) {
    this.baseURL = baseURL
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    }
  }

  getBaseURL(): string {
    return this.baseURL
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...config.headers,
    }

    const url = `${this.baseURL}${endpoint}`

    // Create abort controller for timeout
    const timeoutMs = config.timeout ?? DEFAULT_TIMEOUT
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)

    // Combine user signal with timeout signal
    // AbortSignal.any() is not widely supported, use fallback
    let signal: AbortSignal
    if (config.signal) {
      // Use user's signal directly and handle timeout separately
      signal = config.signal
      // Set up timeout handling
      const timeoutAbort = () => {
        if (!config.signal?.aborted) {
          timeoutController.abort()
        }
      }
      setTimeout(timeoutAbort, timeoutMs)
    } else {
      signal = timeoutController.signal
    }

    try {
      const response = await fetch(url, {
        method: config.method || 'GET',
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))

        // Handle 401 Unauthorized - token may have expired
        if (response.status === 401 && !config.skipAuthRefresh) {
          // Try to refresh token and retry
          const { useAuthStore } = await import('@/stores/authStore')
          const refreshed = await useAuthStore.getState().checkAndRefreshToken()

          if (refreshed) {
            // Retry with new token
            const newToken = useAuthStore.getState().accessToken
            if (newToken) {
              headers['Authorization'] = `Bearer ${newToken}`
              const retryResponse = await fetch(url, {
                method: config.method || 'GET',
                headers,
                body: config.body ? JSON.stringify(config.body) : undefined,
                signal,
              })

              if (retryResponse.ok) {
                return retryResponse.json()
              }
            }
          }
        }

        throw new Error(error.detail || error.message || `HTTP ${response.status}`)
      }

      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('请求已取消')
        }
        if (error.name === 'TimeoutError' || error.message.includes('abort')) {
          throw new Error('请求超时，请重试')
        }
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' })
  }

  async post<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body })
  }

  async put<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body })
  }

  async patch<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body })
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)