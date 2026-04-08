'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { ChevronDown, Check, Sparkles, Code, Brain, Eye } from 'lucide-react'

export interface AIModel {
  id: string
  name: string
  provider: string
  capabilities: string[]
  description: string
}

export const AVAILABLE_MODELS: AIModel[] = [
  // 千问系列
  {
    id: 'qwen3.5-plus',
    name: 'Qwen 3.5 Plus',
    provider: '千问',
    capabilities: ['文本生成', '深度思考', '视觉理解'],
    description: '通用的强大模型，支持多种任务',
  },
  {
    id: 'qwen3-max-2026-01-23',
    name: 'Qwen 3 Max',
    provider: '千问',
    capabilities: ['文本生成', '深度思考'],
    description: '最强推理能力，适合复杂任务',
  },
  {
    id: 'qwen3-coder-next',
    name: 'Qwen 3 Coder Next',
    provider: '千问',
    capabilities: ['代码'],
    description: '代码专用模型，编程能力强',
  },
  {
    id: 'qwen3-coder-plus',
    name: 'Qwen 3 Coder Plus',
    provider: '千问',
    capabilities: ['代码'],
    description: '代码助手，支持多种语言',
  },
  // 智谱系列
  {
    id: 'glm-5',
    name: 'GLM-5',
    provider: '智谱',
    capabilities: ['文本生成', '深度思考'],
    description: '智谱最新模型，综合能力强',
  },
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    provider: '智谱',
    capabilities: ['文本生成', '深度思考'],
    description: '智谱稳定版本，性能可靠',
  },
  // Kimi系列
  {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'Kimi',
    capabilities: ['文本生成', '深度思考', '视觉理解'],
    description: '月之暗面出品，长文本能力强',
  },
  // MiniMax系列
  {
    id: 'MiniMax-M2.5',
    name: 'MiniMax M2.5',
    provider: 'MiniMax',
    capabilities: ['文本生成', '深度思考'],
    description: 'MiniMax旗舰模型，创意能力强',
  },
]

// Models that support deep thinking (showing reasoning process)
export const THINKING_MODELS = [
  'qwen3.5-plus',
  'qwen3-max',
  'qwen3-max-2026-01-23',
  'glm-5',
  'glm-4.7',
  'kimi-k2.5',
  'MiniMax-M2.5',
]

// Models that support visual understanding (multimodal image input)
export const MULTIMODAL_MODELS = [
  'qwen3.5-plus',
  'kimi-k2.5',
]

// Check if a model supports deep thinking
export function isThinkingModel(modelId: string): boolean {
  return THINKING_MODELS.some(m => modelId.toLowerCase().includes(m.toLowerCase()))
}

// Check if a model supports visual understanding (multimodal)
export function isMultimodalModel(modelId: string): boolean {
  return MULTIMODAL_MODELS.some(m => modelId.toLowerCase().includes(m.toLowerCase()))
}

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (modelId: string) => void
  disabled?: boolean
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedModelInfo = AVAILABLE_MODELS.find((m) => m.id === selectedModel)

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case '千问':
        return <Sparkles className="w-4 h-4" />
      case '智谱':
        return <Brain className="w-4 h-4" />
      case 'Kimi':
        return <Eye className="w-4 h-4" />
      case 'MiniMax':
        return <Code className="w-4 h-4" />
      default:
        return <Sparkles className="w-4 h-4" />
    }
  }

  const groupedModels = React.useMemo(() => {
    const groups: Record<string, AIModel[]> = {}
    AVAILABLE_MODELS.forEach((model) => {
      if (!groups[model.provider]) {
        groups[model.provider] = []
      }
      groups[model.provider].push(model)
    })
    return groups
  }, [])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          'bg-secondary-100 dark:bg-secondary-800 hover:bg-secondary-200 dark:hover:bg-secondary-700',
          'border border-secondary-200 dark:border-secondary-700',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {selectedModelInfo && getProviderIcon(selectedModelInfo.provider)}
        <span className="max-w-[120px] truncate">
          {selectedModelInfo?.name || '选择模型'}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-secondary-900 rounded-lg shadow-lg border border-secondary-200 dark:border-secondary-700 overflow-hidden z-50">
          <div className="p-2 border-b border-secondary-200 dark:border-secondary-700">
            <p className="text-xs font-medium text-secondary-600 dark:text-secondary-400">
              选择AI模型
            </p>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider}>
                <div className="px-3 py-2 bg-secondary-50 dark:bg-secondary-800/50">
                  <p className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">
                    {provider}
                  </p>
                </div>
                {models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onModelChange(model.id)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full px-3 py-2.5 text-left hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors',
                      selectedModel === model.id &&
                        'bg-primary-50 dark:bg-primary-900/20'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getProviderIcon(model.provider)}
                          <span className="text-sm font-medium text-secondary-900 dark:text-white">
                            {model.name}
                          </span>
                        </div>
                        <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">
                          {model.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {model.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>
                      {selectedModel === model.id && (
                        <Check className="w-4 h-4 text-primary-600 dark:text-primary-400 mt-1" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}