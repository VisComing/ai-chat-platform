'use client'

import * as React from 'react'
  import { cn } from '@/lib/utils'
  import { Zap, Diamond, Sparkles, Search, Send, Paperclip, Brain, Loader2 } from 'lucide-react'
  import { ModelSelector } from './ModelSelector'
  import { VoiceInput } from './VoiceInput'

// ============= Types =============

export type ChatMode = 'quick' | 'expert'

interface DeepSeekStartPageProps {
  onSend: (content: string, options?: {
    mode?: ChatMode
    enableDeepThinking?: boolean
    enableSearch?: boolean
    enableDeepResearch?: boolean
  }) => void
  isLoading?: boolean
  className?: string
  selectedModel?: string
  onModelChange?: (modelId: string) => void
}

// ============= Brand Logo SVG =============

function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer glow */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Main circle with gradient */}
      <circle cx="24" cy="24" r="20" fill="url(#logoGradient)" filter="url(#glow)" opacity="0.9" />
      {/* Inner whale icon */}
      <path
        d="M32 20c-2.5-5-7.5-7.5-12.5-6.25-3.75 1.25-6.25 5-6.25 8.75 0 5 3.75 10 10 10 2.5 0 5-1.25 6.25-2.5l2.5 1.25c1.25 0 2.5-1.25 1.25-2.5l-1.25-3.75c1.25-1.25 1.25-3.75 0-5z"
        fill="white"
      />
      <circle cx="21" cy="21.5" r="2" fill="#3b82f6" />
    </svg>
  )
}

// ============= Mode Switcher =============

interface ModeSwitcherProps {
  mode: ChatMode
  onChange: (mode: ChatMode) => void
}

function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div className="relative flex items-center bg-slate-100/80 dark:bg-slate-800/50 rounded-full p-1.5 h-12 w-fit backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
      {/* Sliding Background */}
      <div
        className={cn(
          'absolute h-9 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out shadow-lg shadow-blue-500/25',
          mode === 'quick' ? 'w-[calc(50%-6px)] left-1.5' : 'w-[calc(50%-6px)] left-[calc(50%+3px)]'
        )}
      />

      {/* Quick Mode Button */}
      <button
        onClick={() => onChange('quick')}
        className={cn(
          'relative z-10 flex items-center gap-2 px-6 h-9 rounded-full transition-all duration-200',
          mode === 'quick'
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        )}
      >
        <Zap className={cn('w-4 h-4', mode === 'quick' && 'fill-current')} />
        <span className="text-sm font-semibold">快速模式</span>
      </button>

      {/* Expert Mode Button */}
      <button
        onClick={() => onChange('expert')}
        className={cn(
          'relative z-10 flex items-center gap-2 px-6 h-9 rounded-full transition-all duration-200',
          mode === 'expert'
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        )}
      >
        <Diamond className={cn('w-4 h-4', mode === 'expert' && 'fill-current')} />
        <span className="text-sm font-semibold">专家模式</span>
      </button>
    </div>
  )
}

// ============= Feature Buttons =============

interface FeatureButtonsProps {
  mode: ChatMode
  enableDeepThinking: boolean
  enableSearch: boolean
  enableDeepResearch: boolean
  onDeepThinkingChange: (enable: boolean) => void
  onSearchChange: (enable: boolean) => void
  onDeepResearchChange: (enable: boolean) => void
}

function FeatureButtons({
  mode,
  enableDeepThinking,
  enableSearch,
  enableDeepResearch,
  onDeepThinkingChange,
  onSearchChange,
  onDeepResearchChange,
}: FeatureButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* 深度思考 */}
      <button
        onClick={() => onDeepThinkingChange(!enableDeepThinking)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium transition-all duration-200 border',
          enableDeepThinking
            ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/30'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
        )}
      >
        <Brain className={cn('w-4 h-4', enableDeepThinking && 'text-blue-500')} />
        <span className="hidden sm:inline">深度思考</span>
      </button>

      {/* 联网搜索 */}
      <button
        onClick={() => onSearchChange(!enableSearch)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium transition-all duration-200 border',
          enableSearch
            ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/30'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
        )}
      >
        <Search className={cn('w-4 h-4', enableSearch && 'text-blue-500')} />
        <span className="hidden sm:inline">联网搜索</span>
      </button>

      {/* 深度研究（仅专家模式，强制开启） */}
      {mode === 'expert' && (
        <button
          disabled
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium transition-all duration-200 border',
            'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 text-purple-600 dark:from-purple-500/10 dark:to-indigo-500/10 dark:border-purple-500/30 cursor-default'
          )}
          title="专家模式强制开启深度研究"
        >
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="hidden sm:inline">深度研究</span>
        </button>
      )}
    </div>
  )
}

// ============= Main Component =============

export function DeepSeekStartPage({
  onSend,
  isLoading = false,
  className,
  selectedModel,
  onModelChange,
}: DeepSeekStartPageProps) {
  const [mode, setMode] = React.useState<ChatMode>('quick')
  const [inputValue, setInputValue] = React.useState('')
  const [voiceText, setVoiceText] = React.useState('')
  const [enableDeepThinking, setEnableDeepThinking] = React.useState(false)
  const [enableSearch, setEnableSearch] = React.useState(true)
  const [enableDeepResearch, setEnableDeepResearch] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [inputValue])

  // Handle mode change - expert mode forces deep research on
  const handleModeChange = (newMode: ChatMode) => {
    setMode(newMode)
    if (newMode === 'expert') {
      // 专家模式强制开启深度研究，关闭深度思考和联网搜索
      setEnableDeepResearch(true)
      setEnableDeepThinking(false)
      setEnableSearch(false)
    } else {
      // 快速模式关闭深度研究
      setEnableDeepResearch(false)
      setEnableSearch(true)
    }
  }
  const handleDeepResearchChange = (enable: boolean) => {
    // 专家模式下深度研究强制开启，不允许关闭
    if (mode === 'expert') {
      return
    }
    setEnableDeepResearch(enable)
  }

  // Handle voice input result
  const handleVoiceResult = React.useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      // Append final text to input
      setInputValue(prev => prev + text)
      setVoiceText('')
      // Focus textarea after voice input
      setTimeout(() => textareaRef.current?.focus(), 0)
    } else {
      // Show interim text
      setVoiceText(text)
    }
  }, [])

  // Handle send
  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return

    onSend(inputValue.trim(), {
      mode,
      enableDeepThinking,
      enableSearch,
      enableDeepResearch,
    })

    setInputValue('')
  }

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasContent = inputValue.trim().length > 0

  return (
    <div className={cn('flex flex-col items-center justify-center min-h-full px-4 sm:px-6', className)}>
      {/* Brand Section */}
      <div className="flex flex-col items-center mb-6 sm:mb-8" style={{ marginTop: '6vh' }}>
        {/* Logo with enhanced styling */}
        <div className="relative mb-4">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150" />
          {/* Logo container */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-slate-800 shadow-xl shadow-blue-500/20
                          border border-slate-100 dark:border-slate-700 flex items-center justify-center">
            <BrandLogo className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
        </div>

        {/* Title with better typography */}
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
          今天想聊点什么？
        </h1>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5">
          AI 助手随时为您服务
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="mb-5 sm:mb-6">
        <ModeSwitcher mode={mode} onChange={handleModeChange} />
      </div>

      {/* Input Container - Enhanced styling */}
      <div
        className={cn(
          'w-full max-w-[720px] bg-white dark:bg-slate-800/80 rounded-3xl transition-all duration-300',
          'border border-slate-200 dark:border-slate-700/50',
          'shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50',
          isFocused
            ? 'border-blue-400 dark:border-blue-500/50 ring-4 ring-blue-500/10 shadow-xl shadow-blue-500/10'
            : 'hover:shadow-xl hover:shadow-slate-300/50 dark:hover:shadow-slate-900/50'
        )}
      >
        {/* Top Bar: Model Selector */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700/50">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">模型选择</span>
          {selectedModel && onModelChange && (
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={onModelChange}
            />
          )}
        </div>

        {/* Textarea */}
        <div className="p-4 sm:p-5 pb-2 sm:pb-3">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'quick' ? '发送消息开始对话...' : '输入研究问题，开始深度分析...'}
            className={cn(
              'w-full resize-none bg-transparent outline-none text-slate-700 dark:text-slate-200',
              'min-h-[60px] sm:min-h-[80px] max-h-[200px] text-base leading-relaxed',
              'placeholder:text-slate-400'
            )}
            rows={1}
          />
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 pb-4 sm:pb-5">
          {/* Left: Feature Buttons + Voice Input */}
          <div className="flex items-center gap-2">
            <FeatureButtons
              mode={mode}
              enableDeepThinking={enableDeepThinking}
              enableSearch={enableSearch}
              enableDeepResearch={enableDeepResearch}
              onDeepThinkingChange={setEnableDeepThinking}
              onSearchChange={setEnableSearch}
              onDeepResearchChange={handleDeepResearchChange}
            />
            {/* Voice Input */}
            <VoiceInput
              onResult={handleVoiceResult}
              onError={(err) => console.error('[DeepSeekStartPage] Voice error:', err)}
              disabled={isLoading}
            />
            {/* Voice interim text display */}
            {voiceText && (
              <span className="text-sm text-slate-400 italic max-w-[150px] truncate">
                {voiceText}
              </span>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Attachment Button */}
            <button
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl transition-all hidden sm:flex"
              title="添加附件"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Send Button - Enhanced */}
            <button
              onClick={handleSend}
              disabled={!hasContent || isLoading}
              className={cn(
                'flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200',
                hasContent && !isLoading
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:-translate-y-0.5 shadow-lg shadow-blue-500/30'
                  : 'bg-slate-100 dark:bg-slate-700 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send
                  className={cn(
                    'w-5 h-5 transition-transform',
                    hasContent ? 'text-white' : 'text-slate-400'
                  )}
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tips for Expert Mode */}
      {mode === 'expert' && enableDeepResearch && (
        <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 text-center max-w-[720px] px-4">
          <p className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>深度研究将在后台异步执行，您可以关闭页面稍后查看结果</span>
          </p>
        </div>
      )}
    </div>
  )
}

export default DeepSeekStartPage
