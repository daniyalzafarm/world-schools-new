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
import { Button } from '@heroui/react'
import { AlertCircle, Check, CheckCheck, Clock, RefreshCw } from 'lucide-react'
import {
  cn,
  formatMessageTimestamp,
  MessageAttachmentsList,
  UserAvatar,
} from '@world-schools/ui-web'
import { MessageStatus } from '../types'

export interface EnhancedMessage {
  id: string
  text: string
  isUser: boolean
  /**
   * Sender's first name — the static, always-visible part of the name shown on
   * the timestamp line. Set only where attribution is wanted (provider/staff
   * messages); leave undefined to render no name.
   */
  senderFirstName?: string
  /**
   * Sender's last name — collapsed by default and revealed with an inline slide
   * on hover over the name, so the full name appears in place (no popup tooltip).
   */
  senderLastName?: string
  timestamp?: Date
  status?: MessageStatus
  isTransferRequest?: boolean
  isTransferSummary?: boolean
  isChatbot?: boolean
  deliveredAt?: Date | null
  readAt?: Date | null
  attachments?:
    | {
        id: string
        fileName: string
        fileSize: number
        mimeType: string
        fileType: string
        url: string
        thumbnailUrl?: string | null
      }[]
    | null
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

  // Per-message sender label (e.g. the provider staff member who replied). Shown
  // on both incoming and own bubbles so a shared inbox attributes every message;
  // callers set the sender first/last name only where attribution is wanted.
  const showSenderName =
    !message.isTransferSummary &&
    !message.isTransferRequest &&
    !message.isChatbot &&
    !!(message.senderFirstName || message.senderLastName)

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
        {isSending && <Clock size={12} className="animate-pulse" />}
        {isSent && !isDelivered && !isRead && <Check size={12} />}
        {isDelivered && !isRead && <CheckCheck size={12} />}
        {isRead && <CheckCheck size={12} className="text-primary-600" />}
      </div>
    )
  }

  // Sender name shown on the timestamp line. The first name is always visible;
  // the last name is collapsed and slides in place on hover, revealing the full
  // name inline (no popup tooltip). Returns null when no sender is set.
  const renderSenderName = () => {
    if (!showSenderName) return null
    const staticName = message.senderFirstName ?? message.senderLastName
    const revealName = message.senderFirstName ? message.senderLastName : undefined
    return (
      <span
        className="group inline-flex items-center whitespace-nowrap font-medium text-gray-600 dark:text-gray-300 cursor-default"
        aria-label={[message.senderFirstName, message.senderLastName].filter(Boolean).join(' ')}
      >
        <span>{staticName}</span>
        {revealName && (
          <span className="inline-block max-w-0 -translate-x-1 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:ml-1 group-hover:max-w-48 group-hover:translate-x-0 group-hover:opacity-100">
            {revealName}
          </span>
        )}
      </span>
    )
  }

  if (isLeftAligned) {
    return (
      <div className="flex items-end gap-3 mb-4 animate-in slide-in-from-left-2 duration-300">
        <div className="shrink-0">
          <UserAvatar
            photoUrl={message.isTransferSummary ? undefined : avatarSrc}
            fullName={message.isTransferSummary ? 'System' : senderName}
            className="w-8 h-8 text-sm"
            variant="flat"
          />
        </div>
        <div className="max-w-[80%] lg:max-w-[60%]">
          <div
            className={cn(
              // w-fit so the bubble hugs its own content and isn't widened by the
              // name/time line below (which can be wider, and grows on hover).
              'w-fit rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex flex-col gap-2',
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
            {message.attachments && message.attachments.length > 0 && (
              <MessageAttachmentsList
                attachments={message.attachments.map(a => ({
                  id: a.id,
                  fileName: a.fileName,
                  fileSize: a.fileSize,
                  mimeType: a.mimeType,
                  fileType: a.fileType as any,
                  url: a.url,
                  thumbnailUrl: a.thumbnailUrl,
                }))}
              />
            )}
            <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
              {message.text}
            </p>
          </div>
          {(showSenderName || message.timestamp) && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
              {message.timestamp && <span>{formatMessageTimestamp(message.timestamp)}</span>}
              {showSenderName && message.timestamp && <span>·</span>}
              {renderSenderName()}
            </div>
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
            // w-fit + ml-auto: bubble hugs its content and stays pinned to the
            // right, so the name/time line below doesn't stretch it (or grow it on hover).
            'w-fit ml-auto rounded-2xl rounded-br-md px-4 py-3 shadow-sm flex flex-col gap-2',
            message.status === MessageStatus.FAILED
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              : 'bg-primary-100 text-primary-dark'
          )}
        >
          {message.attachments && message.attachments.length > 0 && (
            <MessageAttachmentsList
              attachments={message.attachments.map(a => ({
                id: a.id,
                fileName: a.fileName,
                fileSize: a.fileSize,
                mimeType: a.mimeType,
                fileType: a.fileType as any,
                url: a.url,
                thumbnailUrl: a.thumbnailUrl,
              }))}
            />
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
            {message.text}
          </p>
        </div>
        <div className="flex items-center justify-end gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
          {renderSenderName()}
          {showSenderName && message.timestamp && <span>·</span>}
          {message.timestamp && <span>{formatMessageTimestamp(message.timestamp)}</span>}
          {renderStatusIndicator()}
        </div>
      </div>
    </div>
  )
}
