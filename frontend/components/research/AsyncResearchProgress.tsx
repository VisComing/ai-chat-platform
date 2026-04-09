'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Search,
  CheckCircle,
  Clock,
  FileText,
  Target,
  Loader2,
  AlertCircle,
  ChevronRight,
  Brain,
  Sparkles,
  XCircle,
  Play,
} from 'lucide-react'
import {
  ResearchTaskStatus,
  SubTaskProgress,
  ResearchProgress,
  Citation,
} from '@/services/researchTaskService'

// ============= Phase Config =============

type ResearchPhase = 'clarify' | 'plan' | 'research' | 'synthesize'
type PhaseStatus = 'started' | 'progress' | 'completed' | 'waiting'

const phaseConfig: Record<ResearchPhase, {
  icon: React.ElementType
  label: string
  color: string
}> = {
  clarify: {
    icon: Target,
    label: '范围澄清',
    color: 'text-purple-600',
  },
  plan: {
    icon: Brain,
    label: '研究规划',
    color: 'text-indigo-600',
  },
  research: {
    icon: Search,
    label: '信息搜索',
    color: 'text-blue-600',
  },
  synthesize: {
    icon: FileText,
    label: '报告生成',
    color: 'text-teal-600',
  },
}

// ============= Async Research Progress Panel =============

interface AsyncResearchProgressProps {
  taskStatus: ResearchTaskStatus
  onClarifySubmit?: (answers: string[]) => void
  onCancel?: () => void
  onViewResult?: () => void
  className?: string
}

export function AsyncResearchProgress({
  taskStatus,
  onClarifySubmit,
  onCancel,
  onViewResult,
  className,
}: AsyncResearchProgressProps) {
  const phases: ResearchPhase[] = ['clarify', 'plan', 'research', 'synthesize']
  const currentPhaseIndex = phases.indexOf(taskStatus.phase)

  const isCompleted = taskStatus.status === 'completed'
  const isFailed = taskStatus.status === 'failed'
  const isCancelled = taskStatus.status === 'cancelled'
  const isPaused = taskStatus.status === 'paused'
  const isRunning = taskStatus.status === 'running'

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
          {isCompleted && <CheckCircle className="w-5 h-5 text-green-500" />}
          {isFailed && <AlertCircle className="w-5 h-5 text-red-500" />}
          {isCancelled && <XCircle className="w-5 h-5 text-gray-500" />}
          {isPaused && <Clock className="w-5 h-5 text-amber-500" />}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            深度研究
          </span>
        </div>
        {taskStatus.elapsedTime && (
          <span className="text-sm text-gray-500">
            已用时 {Math.floor(taskStatus.elapsedTime / 60)}:{String(taskStatus.elapsedTime % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Phase Progress Bar */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-1">
          {phases.map((phase, index) => {
            const config = phaseConfig[phase]
            const Icon = config.icon
            const isActive = index === currentPhaseIndex
            const isCompletedPhase = index < currentPhaseIndex || isCompleted

            return (
              <React.Fragment key={phase}>
                <div
                  className={cn(
                    'flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all',
                    isActive && 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500',
                    isCompletedPhase && 'bg-green-50 dark:bg-green-900/20',
                    !isActive && !isCompletedPhase && 'bg-gray-50 dark:bg-gray-700/50'
                  )}
                >
                  {isCompletedPhase ? (
                    <CheckCircle className={cn('w-4 h-4', 'text-green-500')} />
                  ) : isActive && taskStatus.phaseStatus === 'started' ? (
                    <Loader2 className={cn('w-4 h-4 animate-spin', config.color)} />
                  ) : (
                    <Icon className={cn('w-4 h-4', isActive ? config.color : 'text-gray-400')} />
                  )}
                  <span
                    className={cn(
                      'text-xs font-medium hidden sm:inline',
                      isActive ? config.color : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {config.label}
                  </span>
                </div>
                {index < phases.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Status Message */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isRunning && taskStatus.phaseStatus === 'started' && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {taskStatus.phaseMessage || getStatusMessage(taskStatus)}
          </p>
        </div>

        {/* Progress Details */}
        {taskStatus.progress && isRunning && (
          <div className="mt-3 space-y-2">
            {/* Task Progress */}
            {taskStatus.progress.currentTask !== undefined && taskStatus.progress.totalTasks && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>子任务进度</span>
                  <span>{taskStatus.progress.currentTask} / {taskStatus.progress.totalTasks}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(taskStatus.progress.currentTask / taskStatus.progress.totalTasks) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Statistics */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {taskStatus.progress.collectedInfoCount !== undefined && (
                <span>{taskStatus.progress.collectedInfoCount} 条信息</span>
              )}
              {taskStatus.progress.citationCount !== undefined && (
                <span>{taskStatus.progress.citationCount} 个引用</span>
              )}
              {taskStatus.progress.iteration !== undefined && (
                <span>迭代 {taskStatus.progress.iteration}</span>
              )}
            </div>
          </div>
        )}

        {/* Sub Tasks */}
        {taskStatus.subTasks && taskStatus.subTasks.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">研究子任务</p>
            {taskStatus.subTasks.map((task, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg',
                  task.status === 'in_progress'
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                    : task.status === 'completed'
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                )}
              >
                {task.status === 'completed' && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
                {task.status === 'in_progress' && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                )}
                {task.status === 'pending' && (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={cn(
                  'text-sm',
                  task.status === 'in_progress'
                    ? 'text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400'
                )}>
                  {task.topic}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {isFailed && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              研究任务执行失败，请稍后重试
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            取消任务
          </button>
        )}
        {isCompleted && onViewResult && (
          <button
            onClick={onViewResult}
            className="px-4 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600"
          >
            查看报告
          </button>
        )}
        {isPaused && taskStatus.phase === 'clarify' && (
          <span className="text-sm text-amber-600 dark:text-amber-400">
            请回答上方的问题以继续研究
          </span>
        )}
        <div className="flex-1" />
        {taskStatus.taskId && (
          <span className="text-xs text-gray-400">
            任务 ID: {taskStatus.taskId.slice(0, 8)}...
          </span>
        )}
      </div>
    </div>
  )
}

// ============= Helper =============

function getStatusMessage(status: ResearchTaskStatus): string {
  switch (status.status) {
    case 'pending':
      return '任务正在排队等待执行...'
    case 'running':
      return '正在执行研究...'
    case 'paused':
      return '任务已暂停，等待您的回复'
    case 'completed':
      return '研究已完成！'
    case 'failed':
      return '研究任务执行失败'
    case 'cancelled':
      return '任务已取消'
    default:
      return '未知状态'
  }
}

// ============= Clarification Dialog =============

interface ClarificationDialogProps {
  questions: string[]
  onSubmit: (answers: string[]) => void
  onSkip?: () => void
  className?: string
}

export function ClarificationDialogAsync({
  questions,
  onSubmit,
  onSkip,
  className,
}: ClarificationDialogProps) {
  const [answers, setAnswers] = React.useState<string[]>(questions.map(() => ''))

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers]
    newAnswers[index] = value
    setAnswers(newAnswers)
  }

  const handleSubmit = () => {
    const finalAnswers = answers.map((a) => a.trim() || '未指定')
    onSubmit(finalAnswers)
  }

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800', className)}>
      <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            研究需求澄清
          </h3>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          为了提供更精准的研究报告，请回答以下问题：
        </p>
      </div>

      <div className="px-4 py-3 space-y-4">
        {questions.map((question, index) => (
          <div key={index}>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              {index + 1}. {question}
            </label>
            <input
              type="text"
              value={answers[index]}
              onChange={(e) => handleAnswerChange(index, e.target.value)}
              placeholder="输入您的回答..."
              className={cn(
                'w-full px-3 py-2 rounded-lg border',
                'border-gray-200 dark:border-gray-600',
                'bg-gray-50 dark:bg-gray-700',
                'text-gray-900 dark:text-gray-100',
                'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'placeholder:text-gray-400'
              )}
            />
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        {onSkip && (
          <button
            onClick={onSkip}
            className={cn(
              'px-4 py-2 rounded-lg text-sm',
              'text-gray-600 dark:text-gray-400',
              'hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            跳过澄清，直接开始
          </button>
        )}
        <button
          onClick={handleSubmit}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium',
            'bg-blue-500 text-white',
            'hover:bg-blue-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          开始研究
        </button>
      </div>
    </div>
  )
}

// ============= Task List Item =============

interface TaskListItemProps {
  task: {
    taskId: string
    query: string
    status: string
    phase: string
    createdAt: string
    completedAt?: string
    resultUrl?: string
  }
  onClick?: () => void
  className?: string
}

export function TaskListItem({ task, onClick, className }: TaskListItemProps) {
  const statusColors: Record<string, string> = {
    pending: 'text-gray-500',
    running: 'text-blue-500',
    paused: 'text-amber-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
    cancelled: 'text-gray-400',
  }

  const statusLabels: Record<string, string> = {
    pending: '等待中',
    running: '进行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'px-4 py-3 rounded-lg cursor-pointer',
        'hover:bg-gray-50 dark:hover:bg-gray-700/50',
        'border border-gray-200 dark:border-gray-700',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
          {task.query}
        </span>
        <span className={cn('text-xs', statusColors[task.status])}>
          {statusLabels[task.status]}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {new Date(task.createdAt).toLocaleString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}