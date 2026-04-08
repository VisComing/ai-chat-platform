'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'rectangular', width, height, style, ...props }, ref) => {
    const variantClasses = {
      text: 'rounded',
      circular: 'rounded-full',
      rectangular: 'rounded-md',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'animate-pulse bg-secondary-200',
          variantClasses[variant],
          className
        )}
        style={{
          width: width,
          height: height || (variant === 'text' ? '1em' : undefined),
          ...style,
        }}
        {...props}
      />
    )
  }
)
Skeleton.displayName = 'Skeleton'

// Preset skeletons for common use cases
function MessageSkeleton() {
  return (
    <div className="flex gap-3 py-4">
      <Skeleton variant="circular" width={32} height={32} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" height={20} width="80%" />
        <Skeleton variant="text" height={20} width="60%" />
      </div>
    </div>
  )
}

function SessionItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton variant="rectangular" width={32} height={32} className="rounded" />
      <div className="flex-1 space-y-1">
        <Skeleton variant="text" height={16} width="70%" />
        <Skeleton variant="text" height={12} width="40%" />
      </div>
    </div>
  )
}

function ChatInputSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-t border-secondary-200">
      <Skeleton variant="rectangular" width={40} height={40} className="rounded" />
      <Skeleton variant="rectangular" height={40} className="flex-1" />
      <Skeleton variant="rectangular" width={40} height={40} className="rounded" />
    </div>
  )
}

export { Skeleton, MessageSkeleton, SessionItemSkeleton, ChatInputSkeleton }
