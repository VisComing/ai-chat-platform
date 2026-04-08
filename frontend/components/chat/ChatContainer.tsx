'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useChatStore, useMessages } from '@/stores/chatStore'
import { useSessionStore, useCurrentSession } from '@/stores/sessionStore'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { toast } from '@/components/ui'
import { isThinkingModel, isMultimodalModel } from './ModelSelector'
import type { Message, MessageContent } from '@/types'

interface ChatContainerProps {
  className?: string
}

export function ChatContainer({ className }: ChatContainerProps) {
  // Use selector for messages
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

  // Sync current session with chat store
  React.useEffect(() => {
    if (currentSessionId) {
      setCurrentSession(currentSessionId)
    }
  }, [currentSessionId, setCurrentSession])

  // Handle suggestion click from EmptyState
  const handleSuggestionClick = (text: string) => {
    console.log('[ChatContainer] handleSuggestionClick called with:', text)
    setPrefillInput(text)
  }

  // Handle thinking mode change - only allow if current model supports it
  const handleThinkingChange = (enable: boolean) => {
    if (enable && !isThinkingModel(selectedModel)) {
      toast.error('当前模型不支持深度思考，请切换到支持的模型')
      return
    }
    setEnableThinking(enable)

    if (enable && useAgent) {
      setUseAgent(false)
      toast.info('深度思考模式下已关闭联网搜索')
    }
  }

  const handleSend = async (content: string | MessageContent) => {
    console.log('[ChatContainer] handleSend called with content:', JSON.stringify(content))

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
      // Use currentSessionId directly, not currentSession object
      let sessionId = currentSessionId

      // Only create new session if we don't have one
      if (!sessionId) {
        const session = await createSession()
        sessionId = session.id
        // createSession already sets currentSessionId, no need to call selectSession
      }

      await sendMessage({
        sessionId: sessionId,
        content: messageContent,
        enableThinking: enableThinking,
      })
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

  return (
    <div className={cn(className, 'min-h-0')}>
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
    </div>
  )
}