/**
 * Typing Indicator Component for WC Booking
 *
 * Displays an animated typing indicator when users are typing.
 * Features:
 * - Animated bouncing dots
 * - Shows user name(s) typing
 * - Supports multiple users typing
 * - Smooth fade-in/fade-out animations
 *
 * @example
 * ```typescript
 * <TypingIndicator userNames={['John Doe']} />
 * <TypingIndicator userNames={['Alice', 'Bob']} />
 * ```
 */

import React from 'react'
import { cn } from '@world-schools/ui-web'

/**
 * Props for TypingIndicator component
 */
export interface TypingIndicatorProps {
  /**
   * Names of users currently typing
   */
  userNames: string[]

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Whether to show animation
   * @default true
   */
  animated?: boolean

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Typing indicator component with animated dots
 */
export function TypingIndicator({
  userNames,
  className,
  animated = true,
  size = 'md',
}: TypingIndicatorProps) {
  // Don't render if no users are typing
  if (!userNames || userNames.length === 0) return null

  // Format user names text
  const getUserText = () => {
    if (userNames.length === 1) {
      return `${userNames[0]} is typing...`
    } else if (userNames.length === 2) {
      return `${userNames[0]} and ${userNames[1]} are typing...`
    } else {
      return `${userNames[0]} and ${userNames.length - 1} others are typing...`
    }
  }

  // Size classes
  const sizeClasses = {
    sm: {
      container: 'px-3 py-2',
      dot: 'h-1.5 w-1.5',
      text: 'text-xs',
    },
    md: {
      container: 'px-4 py-3',
      dot: 'h-2 w-2',
      text: 'text-sm',
    },
    lg: {
      container: 'px-5 py-4',
      dot: 'h-2.5 w-2.5',
      text: 'text-base',
    },
  }

  const sizes = sizeClasses[size]

  return (
    <div
      className={cn(
        'flex justify-start',
        animated && 'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      <div className={cn('rounded-2xl bg-gray-100 dark:bg-gray-800', 'shadow-sm', sizes.container)}>
        <div className="flex items-center gap-2">
          {/* Animated dots */}
          <div className="flex gap-1">
            <div
              className={cn('animate-bounce rounded-full bg-gray-400 dark:bg-gray-500', sizes.dot)}
              style={{ animationDelay: '0ms', animationDuration: '1s' }}
            />
            <div
              className={cn('animate-bounce rounded-full bg-gray-400 dark:bg-gray-500', sizes.dot)}
              style={{ animationDelay: '200ms', animationDuration: '1s' }}
            />
            <div
              className={cn('animate-bounce rounded-full bg-gray-400 dark:bg-gray-500', sizes.dot)}
              style={{ animationDelay: '400ms', animationDuration: '1s' }}
            />
          </div>

          {/* User name(s) */}
          <span className={cn('text-gray-600 dark:text-gray-400', 'font-medium', sizes.text)}>
            {getUserText()}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Simple typing dots (no user names, just animated dots)
 */
export interface TypingDotsProps {
  /**
   * Whether to show the dots
   */
  show: boolean

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Simple animated typing dots without user names
 */
export function TypingDots({ show, className, size = 'md' }: TypingDotsProps) {
  if (!show) return null

  // Size classes
  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }

  return (
    <div className={cn('flex gap-1', className)}>
      <div
        className={cn('animate-bounce rounded-full bg-gray-400', dotSizes[size])}
        style={{ animationDelay: '0ms', animationDuration: '1s' }}
      />
      <div
        className={cn('animate-bounce rounded-full bg-gray-400', dotSizes[size])}
        style={{ animationDelay: '200ms', animationDuration: '1s' }}
      />
      <div
        className={cn('animate-bounce rounded-full bg-gray-400', dotSizes[size])}
        style={{ animationDelay: '400ms', animationDuration: '1s' }}
      />
    </div>
  )
}
