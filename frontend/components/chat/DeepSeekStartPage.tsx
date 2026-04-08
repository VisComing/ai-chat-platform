'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Zap, Diamond, Sparkles, Search, Send, Paperclip, Brain, Loader2 } from 'lucide-react'

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
}

// ============= Whale Logo SVG =============

function WhaleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-blue-500', className)}
    >
      <path
        d="M20 4C11.163 4 4 11.163 4 20s7.163 16 16 16 16-7.163 16-16S28.837 4 20 4z"
        fill="currentColor"
        opacity="0.1"
      />
      <path
        d="M28 16c-2-4-6-6-10-5-3 1-5 4-5 7 0 4 3 8 8 8 2 0 4-1 5-2l2 1c1 0 2-1 1-2l-1-3c1-1 1-3 0-4z"
        fill="currentColor"
      />
      <circle cx="16" cy="17" r="1.5" fill="white" />
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
    <div className="relative flex items-center bg-[#f5f5f5] dark:bg-white/5 rounded-full p-1 h-11 w-fit">
      {/* Sliding Background */}
      <div
        className={cn(
          'absolute h-9 bg-[#3b82f6] rounded-full transition-transform duration-300 ease-out',
          mode === 'quick' ? 'w-[140px] translate-x-0' : 'w-[140px] translate-x-[140px]'
        )}
      />

      {/* Quick Mode Button */}
      <button
        onClick={() => onChange('quick')}
        className={cn(
          'relative z-10 flex items-center gap-1.5 px-5 h-9 rounded-full transition-colors duration-200',
          mode === 'quick' ? 'text-white' : 'text-[#64748b] hover:text-[#212121] dark:hover:text-white'
        )}
      >
        <Zap className="w-4 h-4" />
        <span className="text-sm font-medium">快速模式</span>
      </button>

      {/* Expert Mode Button */}
      <button
        onClick={() => onChange('expert')}
        className={cn(
          'relative z-10 flex items-center gap-1.5 px-5 h-9 rounded-full transition-colors duration-200',
          mode === 'expert' ? 'text-white' : 'text-[#64748b] hover:text-[#212121] dark:hover:text-white'
        )}
      >
        <Diamond className="w-4 h-4" />
        <span className="text-sm font-medium">专家模式</span>
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
          'flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium transition-all duration-200',
          enableDeepThinking
            ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
            : 'bg-[#f5f5f5] dark:bg-white/5 text-[#64748b] hover:bg-[#e5e7eb] dark:hover:bg-white/10'
        )}
      >
        <Brain className="w-4 h-4" />
        <span className="hidden sm:inline">深度思考</span>
      </button>

      {/* 联网搜索 */}
      <button
        onClick={() => onSearchChange(!enableSearch)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium transition-all duration-200',
          enableSearch
            ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
            : 'bg-[#f5f5f5] dark:bg-white/5 text-[#64748b] hover:bg-[#e5e7eb] dark:hover:bg-white/10'
        )}
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">联网搜索</span>
      </button>

      {/* 深度研究（仅专家模式） */}
      {mode === 'expert' && (
        <button
          onClick={() => onDeepResearchChange(!enableDeepResearch)}
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium transition-all duration-200',
            enableDeepResearch
              ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
              : 'bg-[#f5f5f5] dark:bg-white/5 text-[#64748b] hover:bg-[#e5e7eb] dark:hover:bg-white/10'
          )}
        >
          <Sparkles className="w-4 h-4" />
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
}: DeepSeekStartPageProps) {
  const [mode, setMode] = React.useState<ChatMode>('quick')
  const [inputValue, setInputValue] = React.useState('')
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

  // Handle deep research toggle
  const handleDeepResearchChange = (enable: boolean) => {
    setEnableDeepResearch(enable)
    if (enable) {
      // 深度研究模式下关闭其他选项
      setEnableDeepThinking(false)
      setEnableSearch(false)
    }
  }

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
    <div className={cn('flex flex-col items-center justify-center min-h-full px-3 sm:px-4', className)}>
      {/* Brand Section - 移动端减少顶部间距 */}
      <div className="flex flex-col items-center mb-4 sm:mb-8" style={{ marginTop: '8vh' }}>
        {/* Logo - 品牌蓝，移动端缩小 */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#3b82f6] flex items-center justify-center mb-3 sm:mb-4 shadow-lg shadow-[#3b82f6]/20">
          <WhaleLogo className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <h1 className="text-lg sm:text-xl font-semibold text-[#212121] dark:text-white">
          今天想聊点什么？
        </h1>
      </div>

      {/* Mode Switcher */}
      <div className="mb-4 sm:mb-6">
        <ModeSwitcher mode={mode} onChange={setMode} />
      </div>

      {/* Input Container */}
      <div
        className={cn(
          'w-full max-w-[720px] bg-white dark:bg-[#1a1a2e] rounded-2xl sm:rounded-3xl transition-all duration-200',
          'border border-[#e5e7eb] dark:border-white/[0.08]',
          isFocused
            ? 'border-[#3b82f6] ring-2 sm:ring-4 ring-[#3b82f6]/10'
            : 'shadow-[0_4px_24px_rgba(0,0,0,0.08)]'
        )}
      >
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
              'w-full resize-none bg-transparent outline-none text-[#212121] dark:text-white',
              'min-h-[60px] sm:min-h-[80px] max-h-[200px] text-base leading-relaxed',
              'placeholder:text-[#94a3b8]'
            )}
            rows={1}
          />
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 pb-4 sm:pb-5">
          {/* Left: Feature Buttons */}
          <FeatureButtons
            mode={mode}
            enableDeepThinking={enableDeepThinking}
            enableSearch={enableSearch}
            enableDeepResearch={enableDeepResearch}
            onDeepThinkingChange={setEnableDeepThinking}
            onSearchChange={setEnableSearch}
            onDeepResearchChange={handleDeepResearchChange}
          />

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Attachment Button - 移动端隐藏 */}
            <button
              className="p-2 text-[#94a3b8] hover:text-[#64748b] transition-colors hidden sm:block"
              title="添加附件"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!hasContent || isLoading}
              className={cn(
                'flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full transition-all duration-200',
                hasContent && !isLoading
                  ? 'bg-[#3b82f6] hover:bg-[#2563eb] hover:-translate-y-0.5 shadow-lg shadow-[#3b82f6]/25'
                  : 'bg-[#e5e7eb] dark:bg-white/5 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin" />
              ) : (
                <Send
                  className={cn(
                    'w-4 h-4 sm:w-5 sm:h-5 transition-colors',
                    hasContent ? 'text-white' : 'text-[#94a3b8]'
                  )}
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tips for Expert Mode */}
      {mode === 'expert' && enableDeepResearch && (
        <div className="mt-3 sm:mt-4 text-sm text-[#94a3b8] text-center max-w-[720px] px-3">
          <p className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#3b82f6]" />
            深度研究将在后台异步执行，您可以关闭页面稍后查看结果
          </p>
        </div>
      )}

      {/* Quick Suggestions - 能力卡片网格 */}
      {mode === 'quick' && !hasContent && (
        <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-[720px] w-full px-1 sm:px-0">
          {[
            { icon: '💡', text: '帮我解释量子计算', desc: '科学知识解答' },
            { icon: '📝', text: '写一封商务邮件', desc: '写作助手' },
            { icon: '🔧', text: '帮我调试代码', desc: '编程助手' },
            { icon: '📊', text: '分析数据趋势', desc: '数据分析' },
          ].map((suggestion, i) => (
            <button
              key={i}
              onClick={() => setInputValue(suggestion.text)}
              className="group flex items-center gap-2 sm:gap-3 p-3 sm:p-4 text-left rounded-xl sm:rounded-2xl
                         bg-white dark:bg-[#1a1a2e] border border-[#e5e7eb] dark:border-white/[0.08]
                         hover:border-[#3b82f6]/30 hover:shadow-md hover:-translate-y-0.5
                         transition-all duration-200"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#f5f5f5] dark:bg-white/5 flex items-center justify-center text-base sm:text-lg shrink-0">
                {suggestion.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#212121] dark:text-white truncate">
                  {suggestion.text}
                </p>
                <p className="text-xs text-[#94a3b8] hidden sm:block">{suggestion.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default DeepSeekStartPage