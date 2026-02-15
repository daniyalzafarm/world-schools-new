'use client'

import React from 'react'
import { Avatar } from '@heroui/react'
import type { Message } from '@/types/chat'
import { cn } from '@world-schools/ui-web'

interface MessageBubbleProps {
  message: Message
  className?: string
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const { text, isUser, isStreaming } = message

  if (isUser) {
    return (
      <div
        className={cn(
          'flex justify-end mb-4 animate-in slide-in-from-right-2 duration-300',
          className
        )}
      >
        <div className="max-w-[80%] lg:max-w-[70%]">
          <div className="bg-primary-100 rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-end gap-3 mb-4 animate-in slide-in-from-left-2 duration-300',
        className
      )}
    >
      {/* AI Avatar */}
      <div className="shrink-0">
        <Avatar
          src="/assets/schoolable-icon-solid.png"
          alt="Schoolable AI"
          size="sm"
          className="w-8 h-8"
        />
      </div>

      {/* Message Content */}
      <div className="flex-1 max-w-[80%] lg:max-w-[70%]">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
            {text}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 ml-1 animate-pulse" />
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

interface MessageListProps {
  messages: Message[]
  className?: string
}

export function MessageList({ messages, className }: MessageListProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  )
}
