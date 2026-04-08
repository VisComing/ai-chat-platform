'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useChatStore, useMessages } from '@/stores/chatStore'
import { useSessionStore, useCurrentSession } from '@/stores/sessionStore'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { DeepSeekStartPage, ChatMode } from './DeepSeekStartPage'
import { AsyncResearchProgress, ClarificationDialogAsync } from '@/components/research/AsyncResearchProgress'
import { researchTaskService, ResearchTaskStatus as TaskStatus } from '@/services/researchTaskService'
import { toast } from '@/components/ui'
import { isThinkingModel, isMultimodalModel } from './ModelSelector'
import type { Message, MessageContent } from '@/types'

interface ChatContainerProps {
  className?: string
}

export function ChatContainer({ className }: ChatContainerProps) {
  const router = useRouter()
  const messages = useMessages()
  const currentSession = useCurrentSession()

  const {
    isLoading,
    streamingMessageId,
    selectedModel,
    sendMessage,
    stopGeneration,
    regenerateMessage,
    deleteMessage,
    setCurrentSession,
    setSelectedModel,
    useAgent,
    setUseAgent,
    enableThinking,
    setEnableThinking,
  } = useChatStore()

  const { createSession, selectSession, currentSessionId } = useSessionStore()

  // State for prefilling input from suggestions
  const [prefillInput, setPrefillInput] = React.useState('')

  // Deep Research State
  const [activeResearchTask, setActiveResearchTask] = React.useState<TaskStatus | null>(null)
  const [researchLoading, setResearchLoading] = React.useState(false)
  const [clarificationQuestions, setClarificationQuestions] = React.useState<string[] | null>(null)

  // Sync current session with chat store
  React.useEffect(() => {
    if (currentSessionId) {
      setCurrentSession(currentSessionId)
    }
  }, [currentSessionId, setCurrentSession])

  // Resume streaming session after page refresh
  React.useEffect(() => {
    const resumeIfNeeded = async () => {
      if (!currentSessionId || isInitializing) return

      // Check if there's a streaming message that needs to be resumed
      const messages = useChatStore.getState().messagesBySession[currentSessionId] || []
      const streamingMessage = messages.find(m => m.status === 'streaming' && m.role === 'assistant')

      if (streamingMessage) {
        console.log('[ChatContainer] Found streaming message, attempting to resume...')
        const resumed = await useChatStore.getState().resumeSession(currentSessionId)
        if (resumed) {
          toast.success('已恢复之前的对话')
        }
      }
    }

    resumeIfNeeded()
  }, [currentSessionId, isInitializing])

  // Helper for safe localStorage access
  const safeLocalStorage = {
    getItem: (key: string): string | null => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(key, value)
      } catch {
        // Ignore localStorage errors
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(key)
      } catch {
        // Ignore localStorage errors
      }
    },
  }

  // Check for active research task from localStorage on mount
  React.useEffect(() => {
    const savedTaskId = safeLocalStorage.getItem('activeResearchTask')
    if (savedTaskId) {
      researchTaskService.getTaskStatus(savedTaskId).then((status) => {
        if (status.status === 'running' || status.status === 'paused') {
          setActiveResearchTask(status)
          // Start polling if running
          if (status.status === 'running') {
            researchTaskService.startPolling(savedTaskId, (updatedStatus) => {
              setActiveResearchTask(updatedStatus)
            })
          } else if (status.status === 'paused' && status.phase === 'clarify' && status.clarificationQuestions) {
            setClarificationQuestions(status.clarificationQuestions)
          }
        } else {
          // Task is completed/failed/cancelled, clear storage
          safeLocalStorage.removeItem('activeResearchTask')
        }
      }).catch(() => {
        safeLocalStorage.removeItem('activeResearchTask')
      })
    }
  }, [])

  // Handle suggestion click from EmptyState
  const handleSuggestionClick = (text: string) => {
    console.log('[ChatContainer] handleSuggestionClick called with:', text)
    setPrefillInput(text)
  }

  // Handle thinking mode change
  const handleThinkingChange = (enable: boolean) => {
    if (enable && !isThinkingModel(selectedModel)) {
      toast.error('当前模型不支持深度思考，请切换到支持的模型')
      return
    }
    setEnableThinking(enable)
  }

  // Handle deep research
  const handleDeepResearch = async (query: string) => {
    setResearchLoading(true)
    try {
      const result = await researchTaskService.createTask(query, {
        skipClarification: false,
      })

      // Save task ID to localStorage
      safeLocalStorage.setItem('activeResearchTask', result.taskId)

      // Get initial status
      const status = await researchTaskService.getTaskStatus(result.taskId)
      setActiveResearchTask(status)

      // Start polling
      researchTaskService.startPolling(result.taskId, (updatedStatus) => {
        setActiveResearchTask(updatedStatus)

        // Check if paused for clarification - read questions from status
        if (updatedStatus.status === 'paused' && updatedStatus.phase === 'clarify') {
          if (updatedStatus.clarificationQuestions && updatedStatus.clarificationQuestions.length > 0) {
            setClarificationQuestions(updatedStatus.clarificationQuestions)
          }
        }

        // Clear localStorage when completed
        if (['completed', 'failed', 'cancelled'].includes(updatedStatus.status)) {
          safeLocalStorage.removeItem('activeResearchTask')
        }
      })

      toast.success('深度研究任务已创建，正在后台执行...')
    } catch (error: any) {
      toast.error(error.message || '创建深度研究任务失败')
    } finally {
      setResearchLoading(false)
    }
  }

  // Handle clarification submit
  const handleClarificationSubmit = async (answers: string[]) => {
    if (!activeResearchTask) return

    try {
      await researchTaskService.submitClarification(activeResearchTask.taskId, answers)
      setClarificationQuestions(null)
      toast.success('已提交澄清回复，任务继续执行')
    } catch (error: any) {
      toast.error(error.message || '提交澄清失败')
    }
  }

  // Handle cancel research
  const handleCancelResearch = async () => {
    if (!activeResearchTask) return

    try {
      await researchTaskService.cancelTask(activeResearchTask.taskId)
      setActiveResearchTask(null)
      safeLocalStorage.removeItem('activeResearchTask')
      toast.success('研究任务已取消')
    } catch (error: any) {
      toast.error(error.message || '取消任务失败')
    }
  }

  // Handle view research result
  const handleViewResearchResult = async () => {
    if (!activeResearchTask) return

    try {
      const result = await researchTaskService.getTaskResult(activeResearchTask.taskId)
      if (result.reportUrl) {
        // Open report in new tab or download
        window.open(result.reportUrl, '_blank')
      }
    } catch (error: any) {
      toast.error(error.message || '获取报告失败')
    }
  }

  // Handle send from start page
  const handleStartPageSend = async (
    content: string,
    options?: {
      mode?: ChatMode
      enableDeepThinking?: boolean
      enableSearch?: boolean
      enableDeepResearch?: boolean
    }
  ) => {
    // Handle deep research mode
    if (options?.enableDeepResearch) {
      await handleDeepResearch(content)
      return
    }

    // Update settings based on options
    if (options?.enableDeepThinking !== undefined) {
      handleThinkingChange(options.enableDeepThinking)
    }
    if (options?.enableSearch !== undefined) {
      setUseAgent(options.enableSearch)
    }

    // Regular chat
    await handleSend(content)
  }

  const handleSend = async (content: string | MessageContent) => {
    console.log('[ChatContainer] handleSend called')

    // Get sessionId directly from store (not hook value) to ensure latest state
    let sessionId = useSessionStore.getState().currentSessionId

    // Convert string to MessageContent if needed
    let messageContent: MessageContent
    if (typeof content === 'string') {
      if (!content.trim()) {
        console.log('[ChatContainer] Content is empty, returning')
        return
      }
      messageContent = { type: 'text', text: content }
    } else {
      // Validate multimodal content
      if (content.type === 'text' && !content.text?.trim()) {
        console.log('[ChatContainer] Text content is empty, returning')
        return
      }
      if (content.type === 'mixed') {
        const hasValidParts = content.parts?.some(p =>
          (p.type === 'text' && p.text?.trim()) || p.type === 'image'
        )
        if (!hasValidParts) {
          console.log('[ChatContainer] Mixed content has no valid parts, returning')
          return
        }
      }
      messageContent = content
    }

    // Check if model supports multimodal for image content
    const hasImages = messageContent.type === 'image' ||
      (messageContent.type === 'mixed' && messageContent.parts?.some(p => p.type === 'image'))

    if (hasImages && !isMultimodalModel(selectedModel)) {
      toast.error('当前模型不支持图片理解，请切换到 qwen3.5-plus 或 kimi-k2.5')
      return
    }

    try {
      if (!sessionId) {
        console.log('[ChatContainer] No sessionId, creating new session...')
        const session = await createSession()
        sessionId = session.id
        console.log('[ChatContainer] Created session:', sessionId)
        // Update URL without triggering navigation
        window.history.replaceState(null, '', `/chat/${sessionId}`)
      }

      // Sync to chatStore before sending
      setCurrentSession(sessionId)

      console.log('[ChatContainer] Calling sendMessage with sessionId:', sessionId)
      await sendMessage({
        sessionId: sessionId,
        content: messageContent,
        enableThinking: enableThinking,
      })
      console.log('[ChatContainer] sendMessage completed')
    } catch (error) {
      toast.error('发送消息失败，请重试')
      console.error('Send message error:', error)
    }
  }

  const handleStop = () => {
    stopGeneration()
  }

  const handleRegenerate = async (messageId: string) => {
    try {
      await regenerateMessage(messageId)
    } catch (error) {
      toast.error('重新生成失败，请重试')
    }
  }

  const handleCopy = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (message) {
      const text = message.content.type === 'text' ? message.content.text : ''
      await navigator.clipboard.writeText(text)
      toast.success('已复制到剪贴板')
    }
  }

  const handleFeedback = async (messageId: string, type: 'like' | 'dislike') => {
    toast.success(type === 'like' ? '感谢你的反馈！' : '已收到反馈，我们会改进')
  }

  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage(messageId)
      toast.success('消息已删除')
    } catch (error) {
      toast.error('删除失败，请重试')
    }
  }

  // Show start page if no messages and no active research
  const showStartPage = messages.length === 0 && !activeResearchTask

  // Show research progress if active research
  const showResearchProgress = activeResearchTask !== null

  return (
    <div className={cn(className, 'min-h-0 flex flex-col')}>
      {/* Start Page */}
      {showStartPage && (
        <DeepSeekStartPage
          onSend={handleStartPageSend}
          isLoading={isLoading}
          className="flex-1"
        />
      )}

      {/* Research Progress */}
      {showResearchProgress && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <AsyncResearchProgress
            taskStatus={activeResearchTask!}
            onCancel={handleCancelResearch}
            onViewResult={handleViewResearchResult}
            className="w-full max-w-[720px]"
          />

          {/* Clarification Dialog */}
          {clarificationQuestions && (
            <ClarificationDialogAsync
              questions={clarificationQuestions}
              onSubmit={handleClarificationSubmit}
              className="w-full max-w-[720px] mt-4"
            />
          )}
        </div>
      )}

      {/* Regular Chat */}
      {!showStartPage && !showResearchProgress && (
        <>
          {/* Messages */}
          <MessageList
            messages={messages}
            isLoading={isLoading}
            onRegenerate={handleRegenerate}
            onCopy={handleCopy}
            onFeedback={handleFeedback}
            onDelete={handleDelete}
            onSuggestionClick={handleSuggestionClick}
          />

          {/* Input Area */}
          <InputArea
            onSend={handleSend}
            onStop={handleStop}
            isLoading={isLoading}
            disabled={false}
            placeholder="输入消息..."
            showSettings={false}
            showModelSelector={true}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            useAgent={useAgent}
            onAgentChange={setUseAgent}
            enableThinking={enableThinking}
            onThinkingChange={handleThinkingChange}
            initialValue={prefillInput}
          />
        </>
      )}
    </div>
  )
}