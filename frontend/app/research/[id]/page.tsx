'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AsyncResearchProgress, ClarificationDialogAsync } from '@/components/research/AsyncResearchProgress'
import { researchTaskService, ResearchTaskStatus as TaskStatus } from '@/services/researchTaskService'
import { toast } from '@/components/ui'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useState, useEffect } from 'react'

export default function ResearchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [taskStatus, setTaskStatus] = React.useState<TaskStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [clarificationQuestions, setClarificationQuestions] = React.useState<string[] | null>(null)

  const { isAuthenticated } = useAuthStore()
  const { selectSession } = useSessionStore()

  // 未认证时跳转
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  // 检测屏幕宽度
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

  // 加载任务状态
  React.useEffect(() => {
    if (!taskId) return

    const loadTask = async () => {
      try {
        const status = await researchTaskService.getTaskStatus(taskId)
        setTaskStatus(status)

        // 如果任务正在运行或等待中，开始轮询
        if (['pending', 'running'].includes(status.status)) {
          researchTaskService.startPolling(taskId, (updatedStatus) => {
            setTaskStatus(updatedStatus)
            // 处理澄清暂停
            if (updatedStatus.status === 'paused' && updatedStatus.phase === 'clarify' && updatedStatus.clarificationQuestions) {
              setClarificationQuestions(updatedStatus.clarificationQuestions)
            }
          })
        }

        // 如果任务暂停等待澄清
        if (status.status === 'paused' && status.phase === 'clarify' && status.clarificationQuestions) {
          setClarificationQuestions(status.clarificationQuestions)
        }
      } catch (error: any) {
        toast.error(error.message || '加载任务失败')
      } finally {
        setLoading(false)
      }
    }

    loadTask()

    // 清理：停止轮询
    return () => {
      researchTaskService.stopPolling()
    }
  }, [taskId])

  // 取消研究
  const handleCancel = async () => {
    if (!taskId) return
    try {
      await researchTaskService.cancelTask(taskId)
      toast.success('研究任务已取消')
      router.push('/')
    } catch (error: any) {
      toast.error(error.message || '取消失败')
    }
  }

  // 查看结果
  const handleViewResult = async () => {
    if (!taskId) return
    try {
      const result = await researchTaskService.getTaskResult(taskId)
      if (result.reportUrl) {
        window.open(result.reportUrl, '_blank')
      }
    } catch (error: any) {
      toast.error(error.message || '获取报告失败')
    }
  }

  // 提交澄清回复
  const handleClarificationSubmit = async (answers: string[]) => {
    if (!taskId) return
    try {
      await researchTaskService.submitClarification(taskId, answers)
      setClarificationQuestions(null)
      toast.success('已提交回复，任务继续执行')
    } catch (error: any) {
      toast.error(error.message || '提交失败')
    }
  }

  // 新建对话
  const handleNewChat = () => {
    selectSession(null)
    router.push('/')
  }

  // 选择会话
  const handleSelectSession = (sessionId: string) => {
    router.push(`/chat/${sessionId}`)
  }

  const getPhaseTitle = () => {
    if (!taskStatus) return '深度研究'
    switch (taskStatus.phase) {
      case 'clarify': return '范围澄清'
      case 'plan': return '研究规划'
      case 'research': return '迭代研究'
      case 'synthesize': return '综合报告'
      default: return '深度研究'
    }
  }

  return (
    <div className="h-screen flex bg-white dark:bg-slate-900">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title={taskStatus?.query?.slice(0, 30) || '深度研究'}
        />

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-slate-600 dark:text-slate-400">加载中...</p>
              </div>
            </div>
          ) : !taskStatus ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">任务不存在或已过期</p>
                <Button onClick={() => router.push('/')}>返回首页</Button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-4">
              <AsyncResearchProgress
                taskStatus={taskStatus}
                onCancel={handleCancel}
                onViewResult={handleViewResult}
              />

              {/* Clarification Dialog */}
              {clarificationQuestions && (
                <div className="mt-4">
                  <ClarificationDialogAsync
                    questions={clarificationQuestions}
                    onSubmit={handleClarificationSubmit}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}