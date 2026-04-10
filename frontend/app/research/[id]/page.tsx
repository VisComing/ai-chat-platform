'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AsyncResearchProgress, ClarificationDialogAsync } from '@/components/research/AsyncResearchProgress'
import { researchTaskService, ResearchTaskStatus as TaskStatus } from '@/services/researchTaskService'
import { toast } from '@/components/ui'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'

export default function ResearchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [taskStatus, setTaskStatus] = React.useState<TaskStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [clarificationQuestions, setClarificationQuestions] = React.useState<string[] | null>(null)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-slate-600 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (!taskStatus) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">任务不存在或已过期</p>
          <Button onClick={() => router.push('/')}>返回首页</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-medium text-slate-900 dark:text-white truncate">
              {taskStatus.phase === 'clarify' ? '范围澄清' :
               taskStatus.phase === 'plan' ? '研究规划' :
               taskStatus.phase === 'research' ? '迭代研究' :
               taskStatus.phase === 'synthesize' ? '综合报告' : '深度研究'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              任务 ID: {taskId.slice(0, 8)}...
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
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
    </div>
  )
}