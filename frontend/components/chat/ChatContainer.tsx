'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useChatStore, useMessages } from '@/stores/chatStore'
import { useSessionStore, useCurrentSession } from '@/stores/sessionStore'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { DeepSeekStartPage, ChatMode } from './DeepSeekStartPage'
import { researchTaskService } from '@/services/researchTaskService'
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
    enableSearch,
    setEnableSearch,
    enableThinking,
    setEnableThinking,
  } = useChatStore()

  const { createSession, selectSession, currentSessionId } = useSessionStore()

  // State for prefilling input from suggestions
  const [prefillInput, setPrefillInput] = React.useState('')

  // State for initialization
  const [isInitializing, setIsInitializing] = React.useState(false)

  // Deep Research State (only for creating task, then navigate to detail page)
  const [researchLoading, setResearchLoading] = React.useState(false)

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

      setIsInitializing(true)
      try {
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
      } finally {
        setIsInitializing(false)
      }
    }

    resumeIfNeeded()
  }, [currentSessionId, isInitializing])

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

  // Handle deep research - navigate to research page
  const handleDeepResearch = async (query: string) => {
    setResearchLoading(true)
    try {
      const result = await researchTaskService.createTask(query, {
        skipClarification: false,
      })

      // Navigate to research detail page
      router.push(`/research/${result.taskId}`)
      toast.success('深度研究任务已创建')

    } catch (error: any) {
      toast.error(error.message || '创建深度研究任务失败')
    } finally {
      setResearchLoading(false)
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
      setEnableSearch(options.enableSearch)
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
      toast.error('当前模型不支持图片理解')
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

  // Show start page if no messages
  const showStartPage = messages.length === 0

  return (
    <div className={cn(className, 'min-h-0 flex flex-col')}>
      {/* Start Page */}
      {showStartPage && (
        <DeepSeekStartPage
          onSend={handleStartPageSend}
          isLoading={isLoading}
          className="flex-1"
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      )}

      {/* Regular Chat */}
      {!showStartPage && (
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
            enableSearch={enableSearch}
            onSearchChange={setEnableSearch}
            enableThinking={enableThinking}
            onThinkingChange={handleThinkingChange}
            initialValue={prefillInput}
          />
        </>
      )}
    </div>
  )
}