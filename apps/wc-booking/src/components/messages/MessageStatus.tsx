/**
 * Message Status Component for WC Booking
 *
 * Displays message delivery and read status with icons and tooltips.
 * Features:
 * - Status icons (sending, sent, delivered, read, failed)
 * - Color-coded indicators
 * - Tooltip with timestamp details
 * - Retry button for failed messages
 *
 * @example
 * ```typescript
 * <MessageStatus status="SENT" />
 * <MessageStatus status="READ" readAt={new Date()} />
 * <MessageStatus status="FAILED" onRetry={() => retryMessage()} />
 * ```
 */

import React from 'react'
import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react'
import { cn } from '@world-schools/ui-web'
import type { MessageStatus as MessageStatusType } from '@world-schools/wc-frontend-utils'

/**
 * Props for MessageStatus component
 */
export interface MessageStatusProps {
  /**
   * Message status
   */
  status: MessageStatusType | null

  /**
   * Timestamp when message was delivered
   */
  deliveredAt?: Date | null

  /**
   * Timestamp when message was read
   */
  readAt?: Date | null

  /**
   * Callback when retry button is clicked (for failed messages)
   */
  onRetry?: () => void

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
}

/**
 * Message status component for showing delivery/read receipts
 */
export function MessageStatus({
  status,
  deliveredAt,
  readAt,
  onRetry,
  showText = false,
  size = 'md',
  className,
}: MessageStatusProps) {
  // Don't render if no status
  if (!status) return null

  // Size classes
  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  }

  const textSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }

  const iconSize = iconSizes[size]
  const textSize = textSizes[size]

  // Determine status display
  const isFailed = status === 'FAILED'
  const isRead = status === 'READ' || readAt
  const isDelivered = status === 'DELIVERED' || deliveredAt
  const isSent = status === 'SENT'
  const isSending = status === 'SENDING'

  // Format timestamp
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  }

  // Render status icon and text
  const renderStatus = () => {
    if (isFailed) {
      return (
        <>
          <AlertCircle size={iconSize} className="text-red-500" />
          {showText && <span className="text-red-500">Failed</span>}
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-1 text-red-500 underline hover:text-red-600"
              type="button"
            >
              Retry
            </button>
          )}
        </>
      )
    }

    if (isSending) {
      return (
        <>
          <Clock size={iconSize} className="animate-spin" />
          {showText && <span>Sending...</span>}
        </>
      )
    }

    if (isRead) {
      return (
        <>
          <CheckCheck size={iconSize} className="text-blue-500" />
          {showText && (
            <span className="text-blue-500">Read{readAt && ` at ${formatTime(readAt)}`}</span>
          )}
        </>
      )
    }

    if (isDelivered) {
      return (
        <>
          <Check size={iconSize} />
          {showText && <span>Delivered{deliveredAt && ` at ${formatTime(deliveredAt)}`}</span>}
        </>
      )
    }

    if (isSent) {
      return (
        <>
          <Check size={iconSize} />
          {showText && <span>Sent</span>}
        </>
      )
    }

    return null
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        textSize,
        'text-gray-500 dark:text-gray-400',
        className
      )}
      role="status"
      aria-label={`Message status: ${status}`}
    >
      {renderStatus()}
    </div>
  )
}
