'use client'

import * as React from 'react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}`
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
    // Auto remove after duration
    const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3000)
    if (toast.type !== 'loading') {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

// Toast helper functions
export const toast = {
  success: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'success', message, title }),
  error: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'error', message, title }),
  warning: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'warning', message, title }),
  info: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'info', message, title }),
  loading: (message: string, title?: string) =>
    useToastStore.getState().addToast({ type: 'loading', message, title }),
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
}

const colorMap = {
  success: 'bg-success-light border-success text-success',
  error: 'bg-error-light border-error text-error',
  warning: 'bg-warning-light border-warning text-warning',
  info: 'bg-info-light border-info text-info',
  loading: 'bg-secondary-100 border-secondary-300 text-secondary-600',
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const { removeToast } = useToastStore()
  const Icon = iconMap[t.type]

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-up',
        'bg-white dark:bg-secondary-800',
        colorMap[t.type]
      )}
      role="alert"
    >
      <Icon className={cn('h-5 w-5 shrink-0', t.type === 'loading' && 'animate-spin')} />
      <div className="flex-1 min-w-0">
        {t.title && <p className="font-medium">{t.title}</p>}
        <p className={cn('text-sm', t.title && 'opacity-80')}>{t.message}</p>
      </div>
      {t.type !== 'loading' && (
        <button
          onClick={() => removeToast(t.id)}
          className="shrink-0 text-secondary-400 hover:text-secondary-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
