'use client'

import React from 'react'
import { Avatar } from '@heroui/react'
import { Users } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { Message } from '../../types/messages'

interface MessageBubbleProps {
  message: Message
  avatarSrc?: string
  senderName?: string
  isAdminView?: boolean
}

export function MessageBubble({
  message,
  avatarSrc = '/assets/avatar.png',
  senderName = 'User',
  isAdminView = false,
}: MessageBubbleProps) {
  // In admin view, user messages are on the left, admin/chatbot on the right
  // In user view, user messages are on the right, chatbot/admin on the left
  const isLeftAligned = isAdminView
    ? message.isUser || message.isTransferSummary
    : !message.isUser

  if (isLeftAligned) {
    return (
      <div className="flex items-end gap-3 mb-4 animate-in slide-in-from-left-2 duration-300">
        <div className="shrink-0">
          <Avatar
            src={
              message.isTransferSummary
                ? '/assets/avatar.png'
                : message.isChatbot
                  ? avatarSrc
                  : '/assets/avatar.png'
            }
            alt={message.isTransferSummary ? 'System' : message.isChatbot ? senderName : 'Admin'}
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
                        : 'Representative'}
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
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
              {message.text}
            </p>
          </div>
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
            'rounded-2xl rounded-br-md px-4 py-3 shadow-sm',
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
                {message.isChatbot ? 'AI Assistant' : isAdminView ? 'You' : 'Representative'}
              </span>
            </div>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.text}
          </p>
        </div>
      </div>
    </div>
  )
}

