import { apiClient } from './apiClient'
import { useAuthStore } from '@/stores/authStore'

const DEBUG = process.env.NODE_ENV === 'development'

let abortController: AbortController | null = null

export interface ResearchPhaseEvent {
  type: 'research_phase'
  phase: 'clarify' | 'plan' | 'search' | 'evaluate' | 'reflect' | 'synthesize'
  status: 'started' | 'progress' | 'completed' | 'waiting'
  message: string
  progress?: {
    current: number
    total: number
  }
  timestamp: string
}

export interface ClarificationRequestEvent {
  type: 'clarification_request'
  questions: string[]
  message: string
}

export interface ResearchPlanEvent {
  type: 'research_plan'
  goal: string
  subTasks: Array<{
    topic: string
    description?: string
    keywords: string[]
    priority: number
  }>
  totalTasks: number
}

export interface SearchProgressEvent {
  type: 'search_progress'
  iteration: number
  maxIterations: number
  query: string
  taskTopic: string
}

export interface SearchCompleteEvent {
  type: 'search_complete'
  resultCount: number
  collectedInfoCount: number
  citationCount: number
}

export interface EvaluationResultEvent {
  type: 'evaluation_result'
  score: number
  isSufficient: boolean
  iteration: number
}

export interface ResearchCompleteEvent {
  type: 'research_complete'
  report: string
  citations: Array<{
    title: string
    link: string
    published_time?: string
    snippet?: string
  }>
  duration: number
  stats: {
    totalTasks: number
    collectedInfoCount: number
    citationCount: number
  }
}

export interface ResearchErrorEvent {
  type: 'error'
  content: string
  phase?: string
}

export type ResearchEvent =
  | ResearchPhaseEvent
  | ClarificationRequestEvent
  | ResearchPlanEvent
  | SearchProgressEvent
  | SearchCompleteEvent
  | EvaluationResultEvent
  | ResearchCompleteEvent
  | ResearchErrorEvent

export interface ResearchRequest {
  query: string
  model?: string
  sessionId?: string
  skipClarification?: boolean
  clarifiedRequirements?: string
}

export interface ClarifyRequest {
  query: string
  answers: string[]
  model?: string
}

class ResearchService {
  private getHeaders(): Record<string, string> {
    const token = useAuthStore.getState().accessToken
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async streamResearch(
    request: ResearchRequest,
    onEvent: (event: ResearchEvent) => void
  ): Promise<void> {
    // Cancel any existing stream
    this.abortStream()

    abortController = new AbortController()
    const signal = abortController.signal

    const headers = this.getHeaders()

    try {
      const response = await fetch(`${apiClient.getBaseURL()}/research/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            continue
          }
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim()
            try {
              const data = JSON.parse(dataStr) as ResearchEvent

              if (DEBUG) {
                console.log('[ResearchService] Event:', data.type, data)
              }

              onEvent(data)

              if (data.type === 'error') {
                throw new Error(data.content || '发生错误')
              }
            } catch (e) {
              if (e instanceof Error && e.message !== '发生错误') {
                continue
              }
              throw e
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

  async submitClarification(
    request: ClarifyRequest,
    onEvent: (event: ResearchEvent) => void
  ): Promise<void> {
    this.abortStream()

    abortController = new AbortController()
    const signal = abortController.signal

    const headers = this.getHeaders()

    try {
      const response = await fetch(`${apiClient.getBaseURL()}/research/clarify`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            continue
          }
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim()
            try {
              const data = JSON.parse(dataStr) as ResearchEvent
              onEvent(data)
            } catch (e) {
              continue
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

  abortStream(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }
}

export const researchService = new ResearchService()