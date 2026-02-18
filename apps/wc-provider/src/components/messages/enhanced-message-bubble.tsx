/**
 * Enhanced Message Bubble Component
 *
 * Displays messages with:
 * - Delivery/read receipt indicators
 * - Message status (sending, sent, delivered, read, failed)
 * - Timestamp formatting
 * - Failed message retry UI
 * - Presence indicators
 */

'use client'

import React from 'react'
import { Avatar, Button } from '@heroui/react'
import { AlertCircle, Check, CheckCheck, Clock, RefreshCw } from 'lucide-react'
import { cn, formatMessageTimestamp } from '@world-schools/ui-web'
import { MessageStatus } from '@world-schools/wc-frontend-utils'

export interface EnhancedMessage {
  id: string
  text: string
  isUser: boolean
  timestamp?: Date
  status?: MessageStatus
  isTransferRequest?: boolean
  isTransferSummary?: boolean
  isChatbot?: boolean
  deliveredAt?: Date | null
  readAt?: Date | null
}

interface EnhancedMessageBubbleProps {
  message: EnhancedMessage
  avatarSrc?: string
  senderName?: string
  isAdminView?: boolean
  onRetry?: (messageId: string) => void
}

export function EnhancedMessageBubble({
  message,
  avatarSrc,
  senderName = 'User',
  isAdminView = false,
  onRetry,
}: EnhancedMessageBubbleProps) {
  const isLeftAligned = isAdminView ? message.isUser || message.isTransferSummary : !message.isUser

  // Render message status indicator (for user messages only)
  const renderStatusIndicator = () => {
    if (!message.isUser || !message.status) return null

    const isFailed = message.status === MessageStatus.FAILED
    const isRead = message.status === MessageStatus.READ || message.readAt
    const isDelivered = message.status === MessageStatus.DELIVERED || message.deliveredAt
    const isSent = message.status === MessageStatus.SENT
    const isSending = message.status === MessageStatus.SENDING

    return (
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        {isFailed && (
          <>
            <AlertCircle size={12} className="text-red-500" />
            <span className="text-red-500">Failed</span>
            {onRetry && (
              <Button
                size="sm"
                variant="light"
                color="danger"
                className="h-5 min-w-0 px-2 text-xs"
                onPress={() => onRetry(message.id)}
                startContent={<RefreshCw size={10} />}
              >
                Retry
              </Button>
            )}
          </>
        )}
        {isSending && (
          <>
            <Clock size={12} className="animate-pulse" />
            <span>Sending...</span>
          </>
        )}
        {isSent && !isDelivered && !isRead && (
          <>
            <Check size={12} />
            <span>Sent</span>
          </>
        )}
        {isDelivered && !isRead && (
          <>
            <Check size={12} />
            <span>Delivered</span>
          </>
        )}
        {isRead && (
          <>
            <CheckCheck size={12} className="text-blue-500" />
            <span className="text-blue-500">Read</span>
          </>
        )}
      </div>
    )
  }

  if (isLeftAligned) {
    return (
      <div className="flex items-end gap-3 mb-4 animate-in slide-in-from-left-2 duration-300">
        <div className="shrink-0">
          <Avatar
            src={message.isTransferSummary ? undefined : avatarSrc}
            name={message.isTransferSummary ? 'System' : senderName}
            alt={message.isTransferSummary ? 'System' : senderName}
            size="sm"
            className="w-8 h-8"
          />
        </div>
        <div className="max-w-[80%] lg:max-w-[60%]">
          <div
            className={cn(
              'rounded-2xl rounded-bl-md px-4 py-3 shadow-sm',
              message.isTransferSummary
                ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                : message.isTransferRequest
                  ? 'bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                  : message.isChatbot
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : message.isUser
                      ? 'bg-primary-100 text-primary-dark'
                      : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
            )}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.text}
            </p>
          </div>
          {message.timestamp && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatMessageTimestamp(message.timestamp)}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Right-aligned messages (user messages)
  return (
    <div className="flex justify-end mb-4 animate-in slide-in-from-right-2 duration-300">
      <div className="max-w-[80%] lg:max-w-[60%]">
        <div
          className={cn(
            'rounded-2xl rounded-br-md px-4 py-3 shadow-sm',
            message.status === MessageStatus.FAILED
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              : 'bg-primary-100 text-primary-dark'
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
        </div>
        <div className="flex items-center justify-end gap-2 mt-1">
          {message.timestamp && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatMessageTimestamp(message.timestamp)}
            </p>
          )}
          {renderStatusIndicator()}
        </div>
      </div>
    </div>
  )
}
