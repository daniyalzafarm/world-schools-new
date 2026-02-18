/**
 * Notification Badge Component for WC Booking
 *
 * Displays an unread message count badge on conversation items.
 * Features:
 * - Shows unread count (1-99+)
 * - Animated appearance/disappearance
 * - Auto-clears when conversation is read
 * - Customizable size and position
 *
 * @example
 * ```typescript
 * <NotificationBadge count={5} />
 * <NotificationBadge count={150} /> // Shows "99+"
 * <NotificationBadge count={0} /> // Hidden
 * ```
 */

import React from 'react'
import { cn } from '@world-schools/ui-web'

/**
 * Props for NotificationBadge component
 */
export interface NotificationBadgeProps {
  /**
   * Number of unread messages
   */
  count: number

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Whether to show animation on mount
   * @default true
   */
  animated?: boolean

  /**
   * Maximum count to display before showing "99+"
   * @default 99
   */
  maxCount?: number
}

/**
 * Notification badge component for displaying unread message counts
 */
export function NotificationBadge({
  count,
  size = 'md',
  className,
  animated = true,
  maxCount = 99,
}: NotificationBadgeProps) {
  // Don't render if count is 0
  if (count <= 0) return null

  // Format count (show "99+" if over maxCount)
  const displayCount = count > maxCount ? `${maxCount}+` : count.toString()

  // Size classes
  const sizeClasses = {
    sm: 'h-4 min-w-[16px] text-[10px] px-1',
    md: 'h-5 min-w-[20px] text-xs px-1.5',
    lg: 'h-6 min-w-[24px] text-sm px-2',
  }

  return (
    <span
      className={cn(
        // Base styles
        'inline-flex items-center justify-center',
        'rounded-full',
        'bg-red-500 text-white',
        'font-semibold',
        'shadow-sm',
        // Size
        sizeClasses[size],
        // Animation
        animated && 'animate-in fade-in zoom-in duration-200',
        // Custom classes
        className
      )}
      aria-label={`${count} unread message${count === 1 ? '' : 's'}`}
      role="status"
    >
      {displayCount}
    </span>
  )
}

/**
 * Notification dot component (simpler version without count)
 */
export interface NotificationDotProps {
  /**
   * Whether to show the dot
   */
  show: boolean

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Whether to show animation on mount
   * @default true
   */
  animated?: boolean
}

/**
 * Simple notification dot (no count, just presence indicator)
 */
export function NotificationDot({
  show,
  size = 'md',
  className,
  animated = true,
}: NotificationDotProps) {
  if (!show) return null

  // Size classes
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  }

  return (
    <span
      className={cn(
        // Base styles
        'inline-block',
        'rounded-full',
        'bg-red-500',
        'shadow-sm',
        // Size
        sizeClasses[size],
        // Animation
        animated && 'animate-in fade-in zoom-in duration-200',
        // Pulse animation
        'animate-pulse',
        // Custom classes
        className
      )}
      aria-label="Unread messages"
      role="status"
    />
  )
}
