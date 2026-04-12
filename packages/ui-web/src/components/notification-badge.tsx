import React from 'react'
import { cn } from '../utils/cn'

export interface NotificationBadgeProps {
  count: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  animated?: boolean
  maxCount?: number
}

export function NotificationBadge({
  count,
  size = 'md',
  className,
  animated = true,
  maxCount = 99,
}: NotificationBadgeProps) {
  if (count <= 0) return null

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString()

  const sizeClasses = {
    sm: 'h-4 min-w-[16px] text-[10px] px-1',
    md: 'h-5 min-w-[20px] text-xs px-1.5',
    lg: 'h-6 min-w-[24px] text-sm px-2',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center',
        'rounded-full',
        'bg-red-500 text-white',
        'font-semibold',
        'shadow-sm',
        sizeClasses[size],
        animated && 'animate-in fade-in zoom-in duration-200',
        className
      )}
      aria-label={`${count} unread message${count === 1 ? '' : 's'}`}
      role="status"
    >
      {displayCount}
    </span>
  )
}

export interface NotificationDotProps {
  show: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  animated?: boolean
}

export function NotificationDot({
  show,
  size = 'md',
  className,
  animated = true,
}: NotificationDotProps) {
  if (!show) return null

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  }

  return (
    <span
      className={cn(
        'inline-block',
        'rounded-full',
        'bg-red-500',
        'shadow-sm',
        sizeClasses[size],
        animated && 'animate-in fade-in zoom-in duration-200',
        'animate-pulse',
        className
      )}
      aria-label="Unread messages"
      role="status"
    />
  )
}
