'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { Send, Image, FileText, Mic, Settings, Smile, X, Search, Globe, Brain, Loader2, BookOpen } from 'lucide-react'
import { ModelSelector, isThinkingModel, isMultimodalModel } from './ModelSelector'
import { VoiceInput } from './VoiceInput'
import { useAuthStore } from '@/stores/authStore'
import type { MessageContent } from '@/types'

interface ImageAttachment {
  id: string
  url: string // Local preview URL (blob URL)
  remoteUrl?: string // Uploaded remote URL
  name: string
  size: number
  mimeType: string
  status: 'pending' | 'uploading' | 'ready' | 'error'
}

interface InputAreaProps {
  onSend: (message: string | MessageContent) => void // Support both string and multimodal content
  onStop?: () => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  showSettings?: boolean
  showModelSelector?: boolean
  selectedModel?: string
  onModelChange?: (model: string) => void
  onSettingsClick?: () => void
  useAgent?: boolean
  onAgentChange?: (useAgent: boolean) => void
  enableThinking?: boolean
  onThinkingChange?: (enable: boolean) => void
  enableDeepResearch?: boolean
  onDeepResearchChange?: (enable: boolean) => void
  initialValue?: string
}

export function InputArea({
  onSend,
  onStop,
  isLoading,
  disabled,
  placeholder = '输入消息...',
  maxLength = 4000,
  showSettings = false,
  showModelSelector = false,
  selectedModel = 'qwen3.5-plus',
  onModelChange,
  onSettingsClick,
  useAgent = false,
  onAgentChange,
  enableThinking = false,
  onThinkingChange,
  enableDeepResearch = false,
  onDeepResearchChange,
  initialValue,
}: InputAreaProps) {
  const [input, setInput] = React.useState(initialValue || '')
  const [images, setImages] = React.useState<ImageAttachment[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Check if current model supports multimodal
  const multimodalSupported = isMultimodalModel(selectedModel)

  // Update input when initialValue changes
  React.useEffect(() => {
    console.log('[InputArea] initialValue changed:', initialValue)
    if (initialValue) {
      setInput(initialValue)
      console.log('[InputArea] Input set to:', initialValue)
      setTimeout(() => {
        console.log('[InputArea] Focusing textarea')
        textareaRef.current?.focus()
      }, 0)
    }
  }, [initialValue])

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Handle image file upload
  const handleImageFile = async (file: File) => {
    // Validation
    if (file.size > 10 * 1024 * 1024) {
      console.warn('[InputArea] Image too large:', file.size)
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      console.warn('[InputArea] Invalid image type:', file.type)
      return
    }

    // Check model support
    if (!multimodalSupported) {
      console.warn('[InputArea] Model does not support images')
      return
    }

    // Create local preview
    const localUrl = URL.createObjectURL(file)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`

    setImages(prev => [...prev, {
      id: tempId,
      url: localUrl,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      status: 'uploading'
    }])

    // Upload to backend
    try {
      const formData = new FormData()
      formData.append('file', file)

      // Get token from Zustand auth store
      const token = useAuthStore.getState().accessToken || ''

      const response = await fetch('/api/v1/files/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const data = await response.json()

      // Update image status
      setImages(prev => prev.map(img =>
        img.id === tempId
          ? { ...img, remoteUrl: data.url, status: 'ready' }
          : img
      ))

      console.log('[InputArea] Image uploaded:', data.url)
    } catch (err) {
      console.error('[InputArea] Image upload failed:', err)
      setImages(prev => prev.map(img =>
        img.id === tempId ? { ...img, status: 'error' } : img
      ))
    }
  }

  // Handle paste event
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          await handleImageFile(file)
        }
      }
    }
  }

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (multimodalSupported) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (!multimodalSupported) return

    const files = e.dataTransfer.files
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await handleImageFile(file)
      }
    }
  }

  // Handle file input click
  const handleImageButtonClick = () => {
    if (multimodalSupported && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      for (const file of files) {
        await handleImageFile(file)
      }
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  // Remove image
  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img?.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url)
      }
      return prev.filter(i => i.id !== id)
    })
  }

  // Build multimodal content for sending
  const buildMultimodalContent = (text: string, images: ImageAttachment[]): MessageContent => {
    const readyImages = images.filter(img => img.status === 'ready')

    if (readyImages.length === 0) {
      return { type: 'text', text }
    }

    return {
      type: 'mixed',
      parts: [
        ...readyImages.map(img => ({
          type: 'image' as const,
          url: img.remoteUrl!,
          alt: img.name,
        })),
        { type: 'text' as const, text }
      ]
    }
  }

  // Handle send
  const handleSend = () => {
    const trimmed = input.trim()
    const readyImages = images.filter(img => img.status === 'ready')

    if (!trimmed && readyImages.length === 0) return
    if (isLoading || disabled) return

    // Build and send multimodal content
    const content = buildMultimodalContent(trimmed, readyImages)
    onSend(content)

    // Clear state
    setInput('')
    setImages([])
    images.forEach(img => {
      if (img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url)
      }
    })

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isOverLimit = input.length > maxLength
  const canSend = (input.trim().length > 0 || images.some(img => img.status === 'ready')) && !isOverLimit && !disabled

  return (
    <div className="border-t border-secondary-200 bg-white dark:bg-secondary-900">
      {/* Settings Bar */}
      {showSettings && (
        <div className="px-4 py-2 border-b border-secondary-100 flex items-center justify-end">
          <button
            onClick={onSettingsClick}
            className="p-1 text-secondary-400 hover:text-secondary-600"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Area - 悬浮卡片设计 */}
      <div className="p-4">
        {/* Image Preview Area */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-3 p-2 bg-secondary-50 dark:bg-secondary-800 rounded-lg flex-wrap">
            {images.map(img => (
              <div key={img.id} className="relative w-16 h-16 group">
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full h-full object-cover rounded border border-secondary-200 dark:border-secondary-700"
                />
                {/* Status overlay */}
                {img.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
                {img.status === 'error' && (
                  <div className="absolute inset-0 bg-red-500/50 rounded flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </div>
                )}
                {/* Remove button */}
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  type="button"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Input Container - 玻璃拟态卡片样式 */}
        <div
          className={cn(
            'flex items-end gap-3 rounded-2xl glass p-3',
            'shadow-sm hover:shadow-md focus-within:shadow-lg',
            'focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20',
            'transition-all duration-200',
            isDragging && 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Toolbar */}
          <div className="flex items-center gap-1 pb-1">
            {/* Deep Thinking Toggle */}
            {onThinkingChange && (
              <button
                onClick={() => onThinkingChange(!enableThinking)}
                disabled={!isThinkingModel(selectedModel)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  !isThinkingModel(selectedModel)
                    ? 'text-secondary-300 cursor-not-allowed opacity-50'
                    : enableThinking
                      ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100'
                )}
                title={!isThinkingModel(selectedModel) ? '当前模型不支持深度思考' : enableThinking ? '深度思考已启用' : '启用深度思考'}
                type="button"
              >
                <Brain className="w-5 h-5" />
              </button>
            )}
            {/* Agent Mode Toggle */}
            {onAgentChange && (
              <button
                onClick={() => onAgentChange(!useAgent)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  useAgent
                    ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100'
                )}
                title={useAgent ? '联网搜索已启用' : '启用联网搜索'}
                type="button"
              >
                <Globe className="w-5 h-5" />
              </button>
            )}
            {/* Deep Research Toggle */}
            {onDeepResearchChange && (
              <button
                onClick={() => onDeepResearchChange(!enableDeepResearch)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  enableDeepResearch
                    ? 'text-teal-500 bg-teal-50 dark:bg-teal-900/20'
                    : 'text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100'
                )}
                title={enableDeepResearch ? '深度研究已启用' : '启用深度研究（完整研究报告）'}
                type="button"
              >
                <BookOpen className="w-5 h-5" />
              </button>
            )}
            {/* Image Upload Button */}
            <button
              onClick={handleImageButtonClick}
              disabled={!multimodalSupported}
              className={cn(
                'p-2 rounded-lg transition-colors',
                !multimodalSupported
                  ? 'text-secondary-300 cursor-not-allowed opacity-50'
                  : 'text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100'
              )}
              title={!multimodalSupported ? '当前模型不支持图片理解' : '上传图片（支持粘贴、拖拽）'}
              type="button"
            >
              <Image className="w-5 h-5" />
            </button>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
              multiple
            />
            <ToolbarButton icon={<FileText className="w-5 h-5" />} title="上传文件" />
            {/* Voice Input */}
            <VoiceInput
              onResult={(text, isFinal) => {
                if (isFinal) {
                  // Final result: append to input
                  setInput(prev => prev ? `${prev} ${text}` : text)
                  setTimeout(() => textareaRef.current?.focus(), 0)
                } else {
                  // Interim result: show in component, don't modify input yet
                  // The VoiceInput component handles interim display internally
                }
              }}
              onError={(error) => {
                console.warn('[InputArea] Voice input error:', error)
              }}
              disabled={disabled || isLoading}
            />
            <ToolbarButton icon={<Smile className="w-5 h-5" />} title="表情" />
          </div>

          {/* Text Input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                'w-full resize-none bg-transparent outline-none text-secondary-900 dark:text-white placeholder:text-secondary-400',
                'max-h-[200px] overflow-y-auto'
              )}
              style={{ minHeight: '24px' }}
            />
          </div>

          {/* Character Count */}
          <div className="flex items-center gap-2">
            {input.length > maxLength * 0.8 && (
              <span
                className={cn(
                  'text-xs',
                  isOverLimit ? 'text-error' : 'text-secondary-400'
                )}
              >
                {input.length}/{maxLength}
              </span>
            )}

            {/* Stop Button */}
            {isLoading ? (
              <button
                onClick={onStop}
                className="w-10 h-10 rounded-full bg-primary-500 text-white
                           hover:bg-primary-600 transition-colors flex items-center justify-center"
                title="停止生成"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shimmer-container',
                  !canSend
                    // 禁用态：灰色半透明
                    ? 'bg-secondary-300 text-secondary-500 opacity-60 cursor-not-allowed'
                    // 有输入时：品牌色渐变 + 发光效果
                    : 'bg-gradient-to-r from-primary-500 to-accent-500 text-white glow-primary hover:scale-105'
                )}
                title={canSend ? '发送' : '请输入内容'}
                type="button"
              >
                <Send className="w-5 h-5 relative z-10" />
              </button>
            )}
          </div>
        </div>

        {/* Model Selector */}
        {showModelSelector && onModelChange && (
          <div className="flex items-center justify-between mt-2 px-1">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              disabled={isLoading || disabled}
            />
          </div>
        )}

        {/* Hints */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary-400">
              按 Enter 发送，Shift + Enter 换行
            </span>
            <div className="flex items-center gap-2">
              {enableThinking && (
                <span className="text-xs text-purple-500 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  深度思考
                </span>
              )}
              {useAgent && (
                <span className="text-xs text-primary-500 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  联网搜索
                </span>
              )}
              {enableDeepResearch && (
                <span className="text-xs text-teal-500 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  深度研究
                </span>
              )}
              {multimodalSupported && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <Image className="w-3 h-3" />
                  支持图片
                </span>
              )}
            </div>
          </div>
          {isLoading && (
            <span className="text-xs text-primary-500 animate-pulse">
              {enableDeepResearch ? '深度研究进行中...' : enableThinking ? '深度思考中...' : useAgent ? 'Agent正在搜索和思考...' : 'AI正在思考中...'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Toolbar Button
function ToolbarButton({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-lg transition-colors"
      title={title}
      type="button"
    >
      {icon}
    </button>
  )
}