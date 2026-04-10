import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, ChatRequest, StreamChunk } from '@/types'
import { chatService } from '@/services/chatService'
import { generateId } from '@/lib/utils'
import { useSessionStore } from './sessionStore'

interface ChatState {
  // Store messages by sessionId
  messagesBySession: Record<string, Message[]>
  currentSessionId: string | null
  currentTaskId: string | null  // 当前运行中的任务 ID
  activeResearchTaskId: string | null  // 当前选中的研究任务 ID
  isLoading: boolean
  streamingMessageId: string | null
  error: string | null
  selectedModel: string
  useAgent: boolean  // Agent mode toggle
  enableThinking: boolean  // Deep thinking mode toggle (DeepSeek R1)
  onSessionCreated?: (sessionId: string) => void // Callback for URL navigation

  // Actions
  getMessages: () => Message[]
  sendMessage: (request: Partial<ChatRequest>) => Promise<void>
  stopGeneration: () => void
  regenerateMessage: (messageId: string) => Promise<void>
  deleteMessage: (messageId: string) => void
  clearMessages: () => void
  loadMessages: (sessionId: string) => Promise<void>
  setCurrentSession: (sessionId: string | null) => void
  setSelectedModel: (model: string) => void
  setUseAgent: (useAgent: boolean) => void
  setEnableThinking: (enable: boolean) => void
  setOnSessionCreated: (callback: (sessionId: string) => void) => void
  setActiveResearchTaskId: (taskId: string | null) => void
  resumeSession: (sessionId: string) => Promise<boolean> // 恢复会话（刷新后）
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesBySession: {},
      currentSessionId: null,
      currentTaskId: null,
      activeResearchTaskId: null,
      isLoading: false,
      streamingMessageId: null,
      error: null,
      selectedModel: 'qwen3.5-plus',
      useAgent: true,  // Default: Agent mode ENABLED
      enableThinking: false,  // Default: Deep thinking mode DISABLED
      onSessionCreated: undefined,

      setActiveResearchTaskId: (taskId: string | null) => {
        set({ activeResearchTaskId: taskId })
      },

      getMessages: () => {
        const { messagesBySession, currentSessionId } = get()
        if (!currentSessionId) return []
        return messagesBySession[currentSessionId] || []
      },

      sendMessage: async (request) => {
        const { messagesBySession, currentSessionId, selectedModel, useAgent } = get()
        let sessionId = request.sessionId || currentSessionId || 'default'
        const currentMessages = messagesBySession[sessionId] || []

        // Create user message
        const userMessage: Message = {
          id: generateId(),
          sessionId,
          role: 'user',
          content: request.content || { type: 'text', text: '' },
          status: 'completed',
          createdAt: new Date(),
        }

        // Create temp AI message
        const aiMessageId = generateId()
        const aiMessage: Message = {
          id: aiMessageId,
          sessionId,
          role: 'assistant',
          content: { type: 'text', text: '' },
          status: 'streaming',
          createdAt: new Date(),
        }

        set({
          messagesBySession: {
            ...messagesBySession,
            [sessionId]: [...currentMessages, userMessage, aiMessage],
          },
          currentSessionId: sessionId,
          isLoading: true,
          streamingMessageId: aiMessageId,
          error: null,
        })

        try {
          // Stream response (use Agent endpoint if enabled)
          console.log('[ChatStore] sendMessage - useAgent:', useAgent, 'selectedModel:', selectedModel)
          const { taskId } = await chatService.streamChat(
            {
              ...request,
              sessionId,
              model: request.model || selectedModel,
            },
            (chunk: StreamChunk) => {
              const state = get()
              const sessionMessages = state.messagesBySession[sessionId] || []

              // Handle task event
              if (chunk.type === 'task' && chunk.taskId) {
                set({ currentTaskId: chunk.taskId })
                return
              }

              // Handle session event
              if (chunk.type === 'session' && chunk.sessionId) {
                console.log('[ChatStore] Session event:', chunk.sessionId)
                // Update current session ID if backend created a new session
                if (!sessionId || sessionId === 'default') {
                  // Move messages from temp sessionId to the real sessionId
                  const tempMessages = get().messagesBySession[sessionId] || []
                  set({
                    currentSessionId: chunk.sessionId,
                    messagesBySession: {
                      ...get().messagesBySession,
                      [chunk.sessionId]: tempMessages,
                    }
                  })
                  // Delete temp messages
                  delete get().messagesBySession[sessionId]
                  // Update sessionStore
                  useSessionStore.getState().selectSession(chunk.sessionId)
                  // Notify about new session (for URL navigation)
                  get().onSessionCreated?.(chunk.sessionId)
                  // Update the local sessionId variable for subsequent event processing
                  sessionId = chunk.sessionId
                }
                return
              }

              // Handle title update event
              if (chunk.type === 'title' && chunk.title) {
                // Use the sessionId from the backend response, or fall back to currentSessionId
                const targetSessionId = chunk.sessionId || get().currentSessionId || sessionId
                console.log('[ChatStore] Title event received:', chunk.title, 'for session:', targetSessionId)
                // Update session title in sessionStore
                useSessionStore.getState().updateSessionTitle(targetSessionId, chunk.title)
                return
              }

              if (chunk.type === 'text' && state.streamingMessageId) {
                set({
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? {
                            ...msg,
                            content: {
                              type: 'text',
                              text: (msg.content.type === 'text' ? msg.content.text : '') + chunk.content,
                            },
                            updatedAt: new Date(),
                          }
                        : msg
                    ),
                  },
                })
              } else if (chunk.type === 'thinking' && state.streamingMessageId) {
                // Handle thinking event - content is incremental for deep thinking mode
                const currentMsg = sessionMessages.find((msg) => msg.id === state.streamingMessageId)
                const existingThinking = currentMsg?.metadata?.thinking || ''

                // If chunk has content, it's incremental; otherwise use status as static text
                const newThinking = chunk.content
                  ? existingThinking + chunk.content  // Incremental from deep thinking
                  : (chunk.status || '正在思考...')   // Static status from agent

                set({
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? {
                            ...msg,
                            metadata: {
                              ...msg.metadata,
                              thinking: newThinking,
                              isDeepThinking: !!chunk.content,  // Mark if it's deep thinking mode
                            },
                          }
                        : msg
                    ),
                  },
                })
              } else if (chunk.type === 'tool_call' && state.streamingMessageId) {
                // Handle tool call event (e.g., web search)
                const toolName = chunk.toolName || 'unknown'
                const queryValue = chunk.toolArgs?.query
                const searchQuery = typeof queryValue === 'string' ? queryValue : ''
                const resultCount = chunk.resultCount || 0
                // 获取搜索结果 sources
                const sources = chunk.sources || []

                set({
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? {
                            ...msg,
                            metadata: {
                              ...msg.metadata,
                              toolCall: {
                                name: toolName,
                                args: chunk.toolArgs,
                              },
                              searchUsed: toolName === 'web_search',
                              searchQuery: searchQuery,
                              searchResultCount: resultCount,
                              sources: sources,  // 实时保存搜索结果
                            },
                          }
                        : msg
                    ),
                  },
                })
              } else if (chunk.type === 'search_result' && state.streamingMessageId) {
                // Handle search result event
                set({
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? {
                            ...msg,
                            metadata: {
                              ...msg.metadata,
                              searchResultCount: chunk.toolResult?.resultCount || 0,
                              sources: chunk.toolResult?.sources || [],
                            },
                          }
                        : msg
                    ),
                  },
                })
              } else if (chunk.type === 'complete') {
                // Re-fetch current state to ensure we have latest messages
                const currentState = get()
                const latestSessionMessages = currentState.messagesBySession[sessionId] || []

                // Get current message to preserve existing metadata
                const currentMessage = latestSessionMessages.find((msg) => msg.id === currentState.streamingMessageId)
                const existingMetadata = currentMessage?.metadata || {}

                // 从 complete 事件直接获取 sources（后端发送格式）
                const completeSources = chunk.sources || chunk.metadata?.sources || existingMetadata.sources || []

                set({
                  isLoading: false,
                  streamingMessageId: null,
                  currentTaskId: null,
                  messagesBySession: {
                    ...currentState.messagesBySession,
                    [sessionId]: latestSessionMessages.map((msg) =>
                      msg.id === currentState.streamingMessageId
                        ? {
                            ...msg,
                            status: 'completed',
                            metadata: {
                              ...existingMetadata,
                              ...chunk.metadata,
                              // Include sources from complete event
                              sources: completeSources,
                              searchUsed: chunk.metadata?.search_used ?? chunk.search_used ?? existingMetadata.searchUsed ?? false,
                            },
                          }
                        : msg
                    ),
                  },
                })
                console.log('[ChatStore] Complete event processed, isLoading set to false')
              } else if (chunk.type === 'error') {
                set({
                  isLoading: false,
                  streamingMessageId: null,
                  currentTaskId: null,
                  error: chunk.content,
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? {
                            ...msg,
                            status: 'error',
                            content: { type: 'text', text: chunk.content || '发生错误' },
                          }
                        : msg
                    ),
                  },
                })
              }
            },
            useAgent  // Pass Agent mode flag
          )

          // Store taskId
          if (taskId) {
            set({ currentTaskId: taskId })
          }
        } catch (error) {
          set({
            isLoading: false,
            streamingMessageId: null,
            currentTaskId: null,
            error: error instanceof Error ? error.message : '发送失败',
          })
        }
      },

      stopGeneration: () => {
        const state = get()
        const sessionId = state.currentSessionId
        if (!sessionId) return

        const sessionMessages = state.messagesBySession[sessionId] || []

        // Cancel task if exists
        if (state.currentTaskId) {
          chatService.cancelTask(state.currentTaskId).catch(console.error)
        } else {
          chatService.abortStream()
        }

        set({
          isLoading: false,
          streamingMessageId: null,
          currentTaskId: null,
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: sessionMessages.map((msg) =>
              msg.id === state.streamingMessageId
                ? { ...msg, status: 'cancelled' }
                : msg
            ),
          },
        })
      },

      regenerateMessage: async (messageId: string) => {
        const state = get()
        const sessionId = state.currentSessionId
        if (!sessionId) return

        const messages = state.messagesBySession[sessionId] || []
        const messageIndex = messages.findIndex((m) => m.id === messageId)

        if (messageIndex <= 0) return

        const userMessage = messages[messageIndex - 1]
        if (userMessage.role !== 'user') return

        const newMessages = messages.slice(0, messageIndex)
        set({
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: newMessages,
          },
        })

        await get().sendMessage({
          content: userMessage.content,
          sessionId,
        })
      },

      deleteMessage: (messageId: string) => {
        const state = get()
        const sessionId = state.currentSessionId
        if (!sessionId) return

        const messages = state.messagesBySession[sessionId] || []
        set({
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: messages.filter((m) => m.id !== messageId),
          },
        })
      },

      clearMessages: () => {
        const state = get()
        const sessionId = state.currentSessionId
        if (!sessionId) return

        set({
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: [],
          },
          isLoading: false,
          streamingMessageId: null,
          currentTaskId: null,
          error: null,
        })
      },

      loadMessages: async (sessionId: string) => {
        try {
          console.log('[ChatStore] Loading messages for session:', sessionId)
          const messages = await chatService.getSessionMessages(sessionId)
          console.log('[ChatStore] Loaded messages:', messages)
          set({
            messagesBySession: {
              ...get().messagesBySession,
              [sessionId]: messages,
            },
            currentSessionId: sessionId,
            error: null,
          })
        } catch (error) {
          console.error('[ChatStore] Load messages error:', error)
          set({
            error: error instanceof Error ? error.message : '加载失败',
          })
        }
      },

      setCurrentSession: (sessionId: string | null) => {
        set({ currentSessionId: sessionId })
      },

      setSelectedModel: (model: string) => {
        set({ selectedModel: model })
      },

      setUseAgent: (useAgent: boolean) => {
        set({ useAgent })
      },

      setEnableThinking: (enableThinking: boolean) => {
        set({ enableThinking })
      },

      setOnSessionCreated: (callback: (sessionId: string) => void) => {
        set({ onSessionCreated: callback })
      },

      resumeSession: async (sessionId: string): Promise<boolean> => {
        /**
         * 恢复会话（刷新页面后）
         *
         * 1. 检查是否有正在运行的任务
         * 2. 如果有，重新订阅 SSE
         * 3. 继续接收消息
         */
        try {
          console.log('[ChatStore] Checking for running task in session:', sessionId)

          // 先加载已有的消息
          await get().loadMessages(sessionId)

          // 检查是否有 streaming 状态的消息
          const messages = get().messagesBySession[sessionId] || []
          const streamingMessage = messages.find(m => m.status === 'streaming' && m.role === 'assistant')

          if (!streamingMessage) {
            console.log('[ChatStore] No streaming message found')
            return false
          }

          // 检查是否有正在运行的任务
          const runningTask = await chatService.getRunningTask(sessionId)

          if (!runningTask) {
            console.log('[ChatStore] No running task found')
            // 没有运行中的任务，将 streaming 消息标记为 cancelled
            set({
              messagesBySession: {
                ...get().messagesBySession,
                [sessionId]: messages.map(m =>
                  m.id === streamingMessage.id
                    ? { ...m, status: 'cancelled' }
                    : m
                ),
              },
            })
            return false
          }

          console.log('[ChatStore] Found running task:', runningTask.taskId)

          // 设置状态
          set({
            isLoading: true,
            streamingMessageId: streamingMessage.id,
            currentTaskId: runningTask.taskId,
          })

          // 重新订阅
          await chatService.subscribeToTask(
            runningTask.taskId,
            streamingMessage.id,
            (chunk: StreamChunk) => {
              const state = get()
              const sessionMessages = state.messagesBySession[sessionId] || []

              if (chunk.type === 'text' && state.streamingMessageId) {
                set({
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? {
                            ...msg,
                            content: {
                              type: 'text',
                              text: (msg.content.type === 'text' ? msg.content.text : '') + chunk.content,
                            },
                            updatedAt: new Date(),
                          }
                        : msg
                    ),
                  },
                })
              } else if (chunk.type === 'thinking' && state.streamingMessageId) {
                const currentMsg = sessionMessages.find((msg) => msg.id === state.streamingMessageId)
                const existingThinking = currentMsg?.metadata?.thinking || ''

                const newThinking = chunk.content
                  ? existingThinking + chunk.content
                  : (chunk.status || '正在思考...')

                set({
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? {
                            ...msg,
                            metadata: {
                              ...msg.metadata,
                              thinking: newThinking,
                              isDeepThinking: !!chunk.content,
                            },
                          }
                        : msg
                    ),
                  },
                })
              } else if (chunk.type === 'tool_call' && state.streamingMessageId) {
                const toolName = chunk.toolName || 'unknown'
                const queryValue = chunk.toolArgs?.query
                const searchQuery = typeof queryValue === 'string' ? queryValue : ''

                set({
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? {
                            ...msg,
                            metadata: {
                              ...msg.metadata,
                              toolCall: { name: toolName, args: chunk.toolArgs },
                              searchUsed: toolName === 'web_search',
                              searchQuery,
                            },
                          }
                        : msg
                    ),
                  },
                })
              } else if (chunk.type === 'complete') {
                const currentState = get()
                const latestSessionMessages = currentState.messagesBySession[sessionId] || []
                const currentMessage = latestSessionMessages.find((msg) => msg.id === currentState.streamingMessageId)
                const existingMetadata = currentMessage?.metadata || {}
                const completeSources = chunk.sources || chunk.metadata?.sources || existingMetadata.sources || []

                set({
                  isLoading: false,
                  streamingMessageId: null,
                  currentTaskId: null,
                  messagesBySession: {
                    ...currentState.messagesBySession,
                    [sessionId]: latestSessionMessages.map((msg) =>
                      msg.id === currentState.streamingMessageId
                        ? {
                            ...msg,
                            status: 'completed',
                            metadata: {
                              ...existingMetadata,
                              ...chunk.metadata,
                              sources: completeSources,
                            },
                          }
                        : msg
                    ),
                  },
                })
              } else if (chunk.type === 'error') {
                set({
                  isLoading: false,
                  streamingMessageId: null,
                  currentTaskId: null,
                  error: chunk.content,
                  messagesBySession: {
                    ...state.messagesBySession,
                    [sessionId]: sessionMessages.map((msg) =>
                      msg.id === state.streamingMessageId
                        ? { ...msg, status: 'error', content: { type: 'text', text: chunk.content || '发生错误' } }
                        : msg
                    ),
                  },
                })
              }
            }
          )

          return true
        } catch (error) {
          console.error('[ChatStore] Resume session error:', error)
          set({
            isLoading: false,
            streamingMessageId: null,
            currentTaskId: null,
            error: error instanceof Error ? error.message : '恢复失败',
          })
          return false
        }
      },
    }),
    {
      name: 'chat-storage',
      // Only persist user preferences, not messages (messages are stored in backend)
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        useAgent: state.useAgent,
        enableThinking: state.enableThinking,
      }),
    }
  )
)

// Selector hook for messages
export function useMessages() {
  const messagesBySession = useChatStore((state) => state.messagesBySession)
  const currentSessionId = useChatStore((state) => state.currentSessionId)

  if (!currentSessionId) return []
  return messagesBySession[currentSessionId] || []
}