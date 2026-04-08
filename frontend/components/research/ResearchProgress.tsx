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
} from 'lucide-react'

export type ResearchPhase = 'clarify' | 'plan' | 'search' | 'evaluate' | 'reflect' | 'synthesize'

interface SubTask {
  topic: string
  keywords: string[]
  priority: number
}

interface ResearchProgressProps {
  currentPhase: ResearchPhase
  phaseStatus: 'started' | 'progress' | 'completed' | 'waiting'
  phaseMessage: string
  progress?: {
    current: number
    total: number
  }
  subTasks?: SubTask[]
  currentTaskIndex?: number
  iterationCount?: number
  maxIterations?: number
  collectedInfoCount?: number
  citationCount?: number
  className?: string
}

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
  search: {
    icon: Search,
    label: '信息搜索',
    color: 'text-blue-600',
  },
  evaluate: {
    icon: CheckCircle,
    label: '质量评估',
    color: 'text-green-600',
  },
  reflect: {
    icon: Sparkles,
    label: '反思分析',
    color: 'text-amber-600',
  },
  synthesize: {
    icon: FileText,
    label: '报告生成',
    color: 'text-teal-600',
  },
}

export function ResearchProgress({
  currentPhase,
  phaseStatus,
  phaseMessage,
  progress,
  subTasks,
  currentTaskIndex,
  iterationCount,
  maxIterations,
  collectedInfoCount,
  citationCount,
  className,
}: ResearchProgressProps) {
  const phases = Object.keys(phaseConfig) as ResearchPhase[]
  const currentPhaseIndex = phases.indexOf(currentPhase)

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      {/* 阶段进度条 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-2">
          {phases.map((phase, index) => {
            const config = phaseConfig[phase]
            const Icon = config.icon
            const isActive = index === currentPhaseIndex
            const isCompleted = index < currentPhaseIndex

            return (
              <React.Fragment key={phase}>
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                    isActive && 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500',
                    isCompleted && 'bg-green-50 dark:bg-green-900/20',
                    !isActive && !isCompleted && 'bg-gray-50 dark:bg-gray-700/50'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className={cn('w-4 h-4', 'text-green-500')} />
                  ) : isActive && phaseStatus === 'started' ? (
                    <Loader2 className={cn('w-4 h-4 animate-spin', config.color)} />
                  ) : (
                    <Icon className={cn('w-4 h-4', isActive ? config.color : 'text-gray-400')} />
                  )}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isActive ? config.color : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {config.label}
                  </span>
                </div>
                {index < phases.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* 当前状态消息 */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {phaseStatus === 'started' && (
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          )}
          {phaseStatus === 'completed' && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          {phaseStatus === 'waiting' && (
            <Clock className="w-5 h-5 text-amber-500" />
          )}
          {phaseStatus === 'progress' && (
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          )}

          <p className="text-sm text-gray-700 dark:text-gray-300">
            {phaseMessage}
          </p>
        </div>

        {/* 任务进度 */}
        {progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>任务进度</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 子任务列表 */}
        {subTasks && subTasks.length > 0 && currentPhase === 'search' && currentTaskIndex !== undefined && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">研究子任务</p>
            {subTasks.map((task, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg',
                  index === currentTaskIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                    : index < currentTaskIndex
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                )}
              >
                {index < currentTaskIndex ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : index === currentTaskIndex ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={cn(
                  'text-sm',
                  index === currentTaskIndex
                    ? 'text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400'
                )}>
                  {task.topic}
                </span>
                {task.keywords.length > 0 && index === currentTaskIndex && (
                  <span className="text-xs text-gray-400">
                    [{task.keywords.join(', ')}]
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 统计信息 */}
        {(collectedInfoCount !== undefined || citationCount !== undefined) && (
          <div className="mt-4 flex items-center gap-4">
            {collectedInfoCount !== undefined && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <FileText className="w-4 h-4" />
                <span>{collectedInfoCount} 条信息</span>
              </div>
            )}
            {citationCount !== undefined && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <CheckCircle className="w-4 h-4" />
                <span>{citationCount} 个引用</span>
              </div>
            )}
            {iterationCount !== undefined && maxIterations !== undefined && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-4 h-4" />
                <span>迭代 {iterationCount}/{maxIterations}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


// 澄清问题对话框组件
interface ClarificationDialogProps {
  questions: string[]
  onSubmit: (answers: string[]) => void
  onSkip: () => void
  className?: string
}

export function ClarificationDialog({
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
    // 过滤空回答，使用默认值
    const finalAnswers = answers.map((a, i) => a.trim() || `未指定`)
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


// 研究报告展示组件
interface Citation {
  title: string
  link: string
  published_time?: string
  snippet?: string
}

interface ResearchReportProps {
  report: string
  citations: Citation[]
  duration: number
  stats: {
    totalTasks: number
    collectedInfoCount: number
    citationCount: number
  }
  className?: string
}

export function ResearchReport({
  report,
  citations,
  duration,
  stats,
  className,
}: ResearchReportProps) {
  // 简单的 Markdown 渲染
  const renderMarkdown = (text: string) => {
    // 处理标题
    let html = text
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>')

    // 处理引用角标
    html = html.replace(/\[(\d+)\]/g, '<sup class="text-blue-500">[$1]</sup>')

    // 处理列表
    html = html.replace(/^\- (.*$)/gm, '<li class="ml-4">$1</li>')

    // 处理段落
    html = html.replace(/\n\n/g, '</p><p class="mt-2">')

    return html
  }

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      {/* 报告头部 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            研究报告
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{Math.round(duration / 60)} 分钟</span>
          <span>{stats.citationCount} 个来源</span>
        </div>
      </div>

      {/* 报告内容 */}
      <div className="px-4 py-4">
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
        />
      </div>

      {/* 引用来源 */}
      {citations.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 mb-2">参考来源</h4>
          <div className="space-y-1">
            {citations.map((citation, index) => (
              <a
                key={index}
                href={citation.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
              >
                <span className="text-xs text-blue-500 font-medium">[{index + 1}]</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-blue-600">
                  {citation.title}
                </span>
                {citation.published_time && (
                  <span className="text-xs text-gray-400">
                    ({citation.published_time})
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}