'use client'

import React from 'react'
import { Avatar } from '@heroui/react'
import { AlertCircle, Check, CheckCheck, Clock, Users } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { Message } from '../../types/messages'
import { MessageAttachmentsList } from './message-attachments-list'

interface MessageBubbleProps {
  message: Message
  avatarSrc?: string
  senderName?: string
  isAdminView?: boolean
}

export function MessageBubble({
  message,
  avatarSrc,
  senderName = 'User',
  isAdminView = false,
}: MessageBubbleProps) {
  // In admin view, user messages are on the left, admin/chatbot on the right
  // In user view, user messages are on the right, chatbot/admin on the left
  const isLeftAligned = isAdminView ? message.isUser || message.isTransferSummary : !message.isUser

  const renderStatusIndicator = () => {
    // Show indicators for outgoing (right-aligned) messages only.
    // In user view: outgoing => message.isUser === true
    // In admin view: outgoing => message.isUser === false
    if (isLeftAligned || !message.status) return null

    const status = String(message.status).toUpperCase()
    const isFailed = status === 'FAILED'
    const isRead = status === 'READ' || !!message.readAt
    const isDelivered = status === 'DELIVERED' || !!message.deliveredAt
    const isSent = status === 'SENT'
    const isSending = status === 'SENDING'

    return (
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        {isFailed && (
          <>
            <AlertCircle size={12} className="text-red-500" />
            <span className="text-red-500">Failed</span>
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
    const avatarName = message.isTransferSummary
      ? 'System'
      : message.isChatbot
        ? senderName
        : message.isUser
          ? senderName
          : isAdminView
            ? 'You'
            : senderName

    return (
      <div className="flex items-end gap-3 mb-4 animate-in slide-in-from-left-2 duration-300">
        <div className="shrink-0">
          <Avatar
            // Only use src when an actual profile photo is available.
            // If src is undefined, HeroUI Avatar will fall back to initials from `name`.
            src={avatarSrc}
            name={avatarName}
            alt={avatarName}
            size="sm"
            className="w-8 h-8"
          />
        </div>
        <div className="max-w-[80%] lg:max-w-[60%]">
          <div
            className={cn(
              'rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex flex-col gap-2',
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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {message.isTransferSummary
                  ? 'Transfer Summary'
                  : message.isChatbot
                    ? 'AI Assistant'
                    : message.isUser
                      ? senderName
                      : isAdminView
                        ? 'You'
                        : senderName}
              </span>
              {message.isTransferRequest && (
                <div className="flex gap-1 items-center">
                  <Users className="w-3 h-3 text-orange-600" />
                  <span className="text-xs bg-orange-100 text-orange-700 py-1 rounded-full">
                    Transfer Request
                  </span>
                </div>
              )}
              {message.isTransferSummary && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                  System
                </span>
              )}
            </div>
            {message.attachments && message.attachments.length > 0 && (
              <MessageAttachmentsList attachments={message.attachments} />
            )}
            <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-gray-900 dark:text-gray-100">
              {message.text}
            </p>
          </div>
          {!!message.timestamp && (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {/* Show status for right-side (sender) messages only; left side is sender=other party */}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Right-aligned messages
  return (
    <div className="flex justify-end mb-4 animate-in slide-in-from-right-2 duration-300">
      <div className="max-w-[80%] lg:max-w-[60%]">
        <div
          className={cn(
            'rounded-2xl rounded-br-md px-4 py-3 shadow-sm flex flex-col gap-2',
            message.isTransferRequest
              ? 'bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
              : message.isChatbot
                ? 'bg-gray-100 dark:bg-gray-800'
                : message.isUser
                  ? 'bg-primary-100 text-primary-dark'
                  : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          )}
        >
          {message.isTransferRequest && (
            <div className="flex items-center gap-2 mb-1">
              <Users size={12} className="text-orange-600" />
              <span className="text-xs font-medium text-orange-700">Transfer Request</span>
            </div>
          )}
          {!message.isUser && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {message.isChatbot ? 'AI Assistant' : isAdminView ? 'You' : senderName}
              </span>
            </div>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <MessageAttachmentsList attachments={message.attachments} />
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
            {message.text}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-end gap-2">
          {message.timestamp && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {renderStatusIndicator()}
        </div>
      </div>
    </div>
  )
}
