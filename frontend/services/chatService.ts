import { apiClient } from './apiClient'
import { useAuthStore } from '@/stores/authStore'
import type { Message, ChatRequest, StreamChunk } from '@/types'

// Debug mode - set to true for verbose logging
const DEBUG = process.env.NODE_ENV === 'development'

let abortController: AbortController | null = null

class ChatService {
  private getHeaders(): Record<string, string> {
    const token = useAuthStore.getState().accessToken
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /**
   * 发送消息并订阅 SSE 流
   *
   * 返回 taskId 用于恢复订阅
   */
  async streamChat(
    request: Partial<ChatRequest>,
    onChunk: (chunk: StreamChunk) => void,
    useAgent: boolean = true
  ): Promise<{ taskId: string | null }> {
    // Cancel any existing stream
    this.abortStream()

    // Create new abort controller
    abortController = new AbortController()
    const signal = abortController.signal

    // Get token from auth store
    const token = useAuthStore.getState().accessToken
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Unified endpoint - useAgent parameter controls the mode
    const endpoint = '/chat/stream'
    if (DEBUG) console.log('[ChatService] useAgent:', useAgent, 'endpoint:', endpoint)

    let currentTaskId: string | null = null

    try {
      const response = await fetch(`${apiClient.getBaseURL()}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: request.sessionId,
          content: request.content,
          model: request.model,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          enableThinking: request.enableThinking,
          useAgent: useAgent,  // Pass useAgent to backend
          tools: request.tools,
        }),
        signal,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.message || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let receivedComplete = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Process any remaining buffer content before exiting
          if (buffer.trim()) {
            const lines = buffer.split('\n')
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const data = JSON.parse(line.slice(5).trim())
                  if (DEBUG) console.log('[ChatService] Final SSE data:', data)

                  if (data.type === 'complete') {
                    onChunk(data)
                    receivedComplete = true
                    return { taskId: currentTaskId }
                  }
                  onChunk(data)
                } catch (e) {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }
          // Handle stream end without complete event - ensure state is cleaned up
          if (!receivedComplete) {
            if (DEBUG) console.log('[ChatService] Stream ended without complete event')
            onChunk({ type: 'complete' })
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        if (DEBUG && buffer.length > 200) {
          console.log('[ChatService] Buffer size:', buffer.length)
        }
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // Event type line
            continue
          }
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim()
            try {
              const data = JSON.parse(dataStr)

              // Handle task event - store taskId for resumption
              if (data.taskId && !data.type) {
                currentTaskId = data.taskId
                if (DEBUG) console.log('[ChatService] Task created:', currentTaskId)
                continue
              }

              // Handle session event (has sessionId but no type)
              if (data.sessionId && !data.type) {
                onChunk({ type: 'session', sessionId: data.sessionId })
                continue
              }

              // Handle tool_call event - normalize format from backend
              if (data.type === 'tool_call') {
                // Backend sends: {type: "tool_call", tool: "web_search", query: "xxx"}
                // Frontend expects: {type: "tool_call", toolName: "xxx", toolArgs: {...}}
                const normalizedChunk = {
                  type: 'tool_call',
                  toolName: data.tool || data.toolName || 'unknown',
                  toolArgs: data.query ? { query: data.query } : data.toolArgs || {},
                  resultCount: data.result_count || data.resultCount,
                }
                onChunk(normalizedChunk as StreamChunk)
                continue
              }

              const chunk = data as StreamChunk

              if (chunk.type === 'error') {
                throw new Error(chunk.content || '发生错误')
              } else {
                onChunk(chunk)
              }

              if (chunk.type === 'complete') {
                receivedComplete = true
                return { taskId: currentTaskId }
              }
            } catch (e) {
              if (e instanceof Error && e.message !== '发生错误') {
                // Ignore parse errors for incomplete chunks
              } else {
                throw e
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled
        return { taskId: currentTaskId }
      }
      throw error
    }

    return { taskId: currentTaskId }
  }

  /**
   * 订阅正在运行的任务
   *
   * 用于刷新页面后恢复 SSE 流
   */
  async subscribeToTask(
    taskId: string,
    messageId: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    // Cancel any existing stream
    this.abortStream()

    // Create new abort controller
    abortController = new AbortController()
    const signal = abortController.signal

    const token = useAuthStore.getState().accessToken
    const headers: Record<string, string> = {}

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    if (DEBUG) console.log('[ChatService] Subscribing to task:', taskId)

    try {
      const response = await fetch(
        `${apiClient.getBaseURL()}/chat/tasks/${taskId}/subscribe`,
        { headers, signal }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.message || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) continue
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim()
            try {
              const data = JSON.parse(dataStr)

              // Handle resumed event
              if (data.type === 'resumed') {
                if (DEBUG) console.log('[ChatService] Resumed task:', taskId)
                continue
              }

              // Handle heartbeat
              if (data.type === 'heartbeat' || dataStr === '{}') {
                continue
              }

              const chunk = data as StreamChunk

              if (chunk.type === 'error') {
                throw new Error(chunk.content || '发生错误')
              } else {
                onChunk(chunk)
              }

              if (chunk.type === 'complete') {
                return
              }
            } catch (e) {
              if (e instanceof Error && !e.message.includes('发生错误')) {
                // Ignore parse errors
              } else {
                throw e
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      throw error
    }
  }

  /**
   * 检查会话中是否有正在运行的任务
   */
  async getRunningTask(sessionId: string): Promise<{ taskId: string; messageId: string; status: string } | null> {
    const response = await apiClient.get<{ success: boolean; data: { taskId: string; messageId: string; status: string } | null }>(
      `/chat/sessions/${sessionId}/running-task`,
      { headers: this.getHeaders() }
    )
    return response.data
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    await apiClient.post(
      `/chat/tasks/${taskId}/cancel`,
      {},
      { headers: this.getHeaders() }
    )
    this.abortStream()
  }

  abortStream(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  async getSessionMessages(sessionId: string): Promise<Message[]> {
    if (DEBUG) console.log('[ChatService] Fetching messages for session:', sessionId)
    const response = await apiClient.get<{ success: boolean; data: Message[] }>(
      `/sessions/${sessionId}/messages`,
      { headers: this.getHeaders() }
    )
    return response.data
  }

  async getMessage(messageId: string): Promise<Message> {
    const response = await apiClient.get<{ success: boolean; data: Message }>(
      `/messages/${messageId}`,
      { headers: this.getHeaders() }
    )
    return response.data
  }

  async deleteMessage(messageId: string): Promise<void> {
    await apiClient.delete(`/messages/${messageId}`, { headers: this.getHeaders() })
  }
}

export const chatService = new ChatService()