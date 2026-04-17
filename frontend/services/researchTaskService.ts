/**
 * Research Task Service - 深度研究异步任务服务
 * 提供任务创建、状态查询、轮询等功能
 */

import { apiClient } from './apiClient'
import { useAuthStore } from '@/stores/authStore'

const DEBUG = process.env.NODE_ENV === 'development'

// ============= Types =============

export interface ResearchProgress {
  currentTask?: number
  totalTasks?: number
  iteration?: number
  maxIterations?: number
  collectedInfoCount?: number
  citationCount?: number
  score?: number
  isSufficient?: boolean
  duration?: number
}

export interface SubTaskProgress {
  topic: string
  status: 'pending' | 'in_progress' | 'completed'
  iteration?: number
  score?: number
}

export interface Citation {
  title: string
  link: string
  publishedTime?: string
  snippet?: string
}

export interface ResearchTaskCreated {
  taskId: string
  status: string
  estimatedDuration: string
  estimatedCost?: {
    searches: string
    tokens: string
  }
  message: string
}

export interface ResearchTaskStatus {
  taskId: string
  query?: string  // Research query/topic
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  phase: 'clarify' | 'plan' | 'research' | 'synthesize'
  phaseStatus: 'started' | 'progress' | 'completed' | 'waiting'
  phaseMessage?: string
  progress?: ResearchProgress
  subTasks?: SubTaskProgress[]
  elapsedTime?: number
  estimatedRemaining?: number
  citations?: Citation[]
  clarificationQuestions?: string[]
}

export interface ResearchTaskResult {
  taskId: string
  status: string
  reportUrl?: string
  reportPreview?: string
  citations?: Citation[]
  stats?: {
    duration?: number
    totalSearches?: number
    totalIterations?: number
  }
}

export interface ResearchTaskListItem {
  taskId: string
  id?: string  // Backend may serialize as 'id' due to Pydantic alias
  query: string
  status: string
  phase: string
  createdAt: string
  completedAt?: string
  resultUrl?: string
}

// Helper to get task ID from either field
export function getTaskId(task: ResearchTaskListItem): string {
  return task.taskId || task.id || ''
}

// ============= Service =============

class ResearchTaskService {
  private pollInterval: NodeJS.Timeout | null = null
  private currentTaskId: string | null = null
  private pollCallback: ((status: ResearchTaskStatus) => void) | null = null
  private consecutiveErrors: number = 0
  private baseIntervalMs: number = 3000
  private maxIntervalMs: number = 30000

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

  /**
   * 创建深度研究任务
   */
  async createTask(
    query: string,
    options?: {
      model?: string
      sessionId?: string
      skipClarification?: boolean
    }
  ): Promise<ResearchTaskCreated> {
    const response = await fetch(`${apiClient.getBaseURL()}/research/tasks`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        query,
        model: options?.model,
        sessionId: options?.sessionId,
        skipClarification: options?.skipClarification || false,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail?.message || error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<ResearchTaskStatus> {
    const response = await fetch(
      `${apiClient.getBaseURL()}/research/tasks/${taskId}`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail?.message || error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * 开始轮询任务状态
   */
  startPolling(
    taskId: string,
    onUpdate: (status: ResearchTaskStatus) => void,
    intervalMs: number = 3000
  ): void {
    // 停止之前的轮询
    this.stopPolling()

    this.currentTaskId = taskId
    this.pollCallback = onUpdate
    this.baseIntervalMs = intervalMs
    this.consecutiveErrors = 0

    // 立即获取一次状态
    this.pollOnce()

    // 开始定时轮询
    this.scheduleNextPoll(intervalMs)

    if (DEBUG) {
      console.log(`[ResearchTaskService] Started polling for task ${taskId}`)
    }
  }

  /**
   * 安排下一次轮询
   */
  private scheduleNextPoll(intervalMs: number): void {
    this.pollInterval = setTimeout(() => {
      this.pollOnce()
    }, intervalMs)
  }

  /**
   * 计算退避间隔
   */
  private getBackoffInterval(): number {
    // 指数退避：baseInterval * 2^errors，最大 maxInterval
    const backoff = this.baseIntervalMs * Math.pow(2, this.consecutiveErrors)
    return Math.min(backoff, this.maxIntervalMs)
  }

  /**
   * 执行一次轮询
   */
  private async pollOnce(): Promise<void> {
    // 捕获当前值，防止竞态条件（stopPolling可能在await期间被调用）
    const taskId = this.currentTaskId
    const callback = this.pollCallback

    if (!taskId || !callback) return

    try {
      const status = await this.getTaskStatus(taskId)
      this.consecutiveErrors = 0 // 重置错误计数
      callback(status)

      // 如果任务已完成，停止轮询
      if (['completed', 'failed', 'cancelled'].includes(status.status)) {
        this.stopPolling()
        return
      }

      // 安排下一次轮询（正常间隔）
      this.scheduleNextPoll(this.baseIntervalMs)
    } catch (error) {
      this.consecutiveErrors++
      console.error('[ResearchTaskService] Poll error:', error)

      // 如果连续错误过多，停止轮询
      if (this.consecutiveErrors >= 5) {
        console.error('[ResearchTaskService] Too many errors, stopping polling')
        this.stopPolling()
        return
      }

      // 使用退避间隔重试
      const backoffInterval = this.getBackoffInterval()
      if (DEBUG) {
        console.log(`[ResearchTaskService] Retrying in ${backoffInterval}ms (error ${this.consecutiveErrors})`)
      }
      this.scheduleNextPoll(backoffInterval)
    }
  }

  /**
   * 停止轮询
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearTimeout(this.pollInterval)
      this.pollInterval = null
    }
    this.currentTaskId = null
    this.pollCallback = null
    this.consecutiveErrors = 0

    if (DEBUG) {
      console.log('[ResearchTaskService] Stopped polling')
    }
  }

  /**
   * 提交澄清回复
   */
  async submitClarification(taskId: string, answers: string[]): Promise<void> {
    const response = await fetch(
      `${apiClient.getBaseURL()}/research/tasks/${taskId}/clarify`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ answers }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail?.message || error.message || `HTTP ${response.status}`)
    }
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const response = await fetch(
      `${apiClient.getBaseURL()}/research/tasks/${taskId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail?.message || error.message || `HTTP ${response.status}`)
    }

    // 停止轮询
    this.stopPolling()
  }

  /**
   * 获取任务结果
   */
  async getTaskResult(taskId: string): Promise<ResearchTaskResult> {
    const response = await fetch(
      `${apiClient.getBaseURL()}/research/tasks/${taskId}/result`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail?.message || error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * 获取用户任务列表
   */
  async listTasks(options?: {
    status?: string
    limit?: number
    offset?: number
  }): Promise<ResearchTaskListItem[]> {
    const params = new URLSearchParams()
    if (options?.status) params.append('status', options.status)
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.offset) params.append('offset', String(options.offset))

    const response = await fetch(
      `${apiClient.getBaseURL()}/research/tasks?${params.toString()}`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail?.message || error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  }

export const researchTaskService = new ResearchTaskService()