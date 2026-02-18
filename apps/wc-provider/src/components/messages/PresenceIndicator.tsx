/**
 * Presence Indicator Component for WC Provider
 *
 * Displays user online/offline/away status with color-coded indicators.
 * Features:
 * - Color-coded status dots (green=online, yellow=away, gray=offline)
 * - Optional status text
 * - Configurable size and position
 * - Tooltip with last seen time (optional)
 *
 * @example
 * ```typescript
 * <PresenceIndicator status="ONLINE" />
 * <PresenceIndicator status="AWAY" showText />
 * <PresenceIndicator status="OFFLINE" size="sm" />
 * ```
 */

import React from 'react'
import { Circle } from 'lucide-react'
import { cn } from '@world-schools/ui-web'
import type { PresenceStatus } from '@world-schools/wc-frontend-utils'

/**
 * Props for PresenceIndicator component
 */
export interface PresenceIndicatorProps {
  /**
   * User presence status
   */
  status: PresenceStatus | null

  /**
   * Whether to show status text
   * @default false
   */
  showText?: boolean

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
   * Position variant (for absolute positioning)
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left' | 'inline'

  /**
   * Whether to show border around the dot
   * @default true
   */
  showBorder?: boolean

  /**
   * Last seen timestamp (for offline status)
   */
  lastSeenAt?: Date | null
}

/**
 * Presence indicator component for showing user online status
 */
export function PresenceIndicator({
  status,
  showText = false,
  size = 'md',
  className,
  position = 'bottom-right',
  showBorder = true,
  lastSeenAt,
}: PresenceIndicatorProps) {
  // Don't render if no status
  if (!status) return null

  // Size classes for dot
  const dotSizes = {
    sm: 8,
    md: 12,
    lg: 16,
  }

  // Position classes
  const positionClasses = {
    'bottom-right': 'absolute bottom-0 right-0',
    'top-right': 'absolute top-0 right-0',
    'bottom-left': 'absolute bottom-0 left-0',
    'top-left': 'absolute top-0 left-0',
    inline: 'inline-flex',
  }

  // Status colors
  const statusColors = {
    ONLINE: 'fill-green-500 text-green-500',
    AWAY: 'fill-yellow-500 text-yellow-500',
    OFFLINE: 'fill-gray-400 text-gray-400',
  }

  // Status text
  const statusText = {
    ONLINE: 'Online',
    AWAY: 'Away',
    OFFLINE: 'Offline',
  }

  const dotSize = dotSizes[size]
  const color = statusColors[status]
  const text = statusText[status]

  if (showText) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Circle
          size={dotSize}
          className={cn(
            'rounded-full',
            color,
            showBorder && 'border-2 border-white dark:border-gray-900'
          )}
        />
        <span className="text-xs text-gray-600 dark:text-gray-400">{text}</span>
      </div>
    )
  }

  return (
    <Circle
      size={dotSize}
      className={cn(
        'rounded-full',
        color,
        positionClasses[position],
        showBorder && 'border-2 border-white dark:border-gray-900',
        className
      )}
      aria-label={`Status: ${text}`}
    />
  )
}

/**
 * Presence badge with status text and optional last seen
 */
export interface PresenceBadgeProps {
  /**
   * User presence status
   */
  status: PresenceStatus | null

  /**
   * Last seen timestamp (for offline status)
   */
  lastSeenAt?: Date | null

  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Presence badge component with status text and last seen time
 */
export function PresenceBadge({ status, lastSeenAt, className }: PresenceBadgeProps) {
  if (!status) return null

  // Status colors for badge
  const badgeColors = {
    ONLINE: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    AWAY: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    OFFLINE: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }

  // Status text
  const statusText = {
    ONLINE: 'Online',
    AWAY: 'Away',
    OFFLINE: 'Offline',
  }

  const formatLastSeen = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        badgeColors[status],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{statusText[status]}</span>
      {status === 'OFFLINE' && lastSeenAt && (
        <span className="opacity-75">• {formatLastSeen(lastSeenAt)}</span>
      )}
    </div>
  )
}
