'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@heroui/react'
import { ChatInput } from './chat-input'
import { cn } from '../../utils/cn'

/** Minimal message shape for the thread; apps pass messages that have at least `id` for keys. */
export interface MessageThreadMessage {
  id: string
}

export interface MessageThreadProps<T extends MessageThreadMessage> {
  /** List of messages to display (oldest first). */
  messages: T[]
  /** Render a single message (e.g. EnhancedMessageBubble). */
  renderMessage: (message: T) => React.ReactNode
  /** Send handler; may be async. Input is cleared after send. */
  onSend: (payload: { content: string; attachments: File[] }) => void | Promise<void>
  /** Show loading skeleton in the message area. */
  isLoading?: boolean
  /** Error message to show with optional retry. */
  error?: string | null
  /** Called when user clicks retry in error state. */
  onRetry?: () => void
  /** Placeholder for the chat input. */
  placeholder?: string
  /** Disable the input and send button. */
  disabled?: boolean
  /** Custom empty state when there are no messages and not loading/error. */
  emptyMessage?: React.ReactNode
  /** Show "Press Enter to send..." help text under input. */
  helpText?: boolean
  /** Optional content rendered before the message list (e.g. "Load older messages" button). */
  renderBeforeMessages?: () => React.ReactNode
  /** Optional content rendered after the message list (e.g. typing indicator). */
  renderAfterMessages?: () => React.ReactNode
  /** Optional loading skeleton when isLoading is true. */
  renderLoading?: () => React.ReactNode
  className?: string
  /** Scroll container class (e.g. for max height). */
  scrollAreaClassName?: string
  /** Maximum number of files that can be attached to a single message. */
  maxAttachments?: number
  /** Maximum combined size of all attachments in bytes. */
  maxTotalAttachmentSizeBytes?: number
}

export function MessageThread<T extends MessageThreadMessage>({
  messages,
  renderMessage,
  onSend,
  isLoading = false,
  error = null,
  onRetry,
  placeholder = 'Type a message...',
  disabled = false,
  emptyMessage,
  helpText = true,
  renderBeforeMessages,
  renderAfterMessages,
  renderLoading,
  className,
  scrollAreaClassName,
  maxAttachments = 10,
  maxTotalAttachmentSizeBytes = 100 * 1024 * 1024,
}: MessageThreadProps<T>) {
  const [inputValue, setInputValue] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleSend = async () => {
    const content = inputValue.trim()
    if ((content.length === 0 && attachments.length === 0) || disabled) return
    setInputValue('')
    try {
      await Promise.resolve(onSend({ content, attachments }))
      setAttachments([])
    } catch {
      setInputValue(content)
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const showEmpty = !isLoading && !error && messages.length === 0
  const defaultEmpty = (
    <div className="flex items-center justify-center h-full min-h-48">
      <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
        No messages yet. Send a message to start.
      </div>
    </div>
  )

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div ref={scrollRef} className={cn('flex-1 overflow-y-auto p-6', scrollAreaClassName)}>
        {isLoading &&
          (renderLoading ? (
            renderLoading()
          ) : (
            <div className="flex items-center justify-center min-h-48 text-gray-500 dark:text-gray-400 text-sm">
              Loading...
            </div>
          ))}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center min-h-48 px-4">
            <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>
            {onRetry && (
              <Button size="sm" color="primary" onPress={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}
        {!isLoading && !error && showEmpty && (emptyMessage ?? defaultEmpty)}
        {!isLoading && !error && messages.length > 0 && renderBeforeMessages?.()}
        {!isLoading && !error && messages.length > 0 && (
          <div className="space-y-4 pb-4">
            {messages.map(msg => (
              <React.Fragment key={msg.id}>{renderMessage(msg)}</React.Fragment>
            ))}
            {renderAfterMessages?.()}
          </div>
        )}
      </div>
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        placeholder={placeholder}
        disabled={disabled}
        helpText={helpText}
        className="border-t border-gray-200 dark:border-gray-700"
        attachments={attachments}
        onFilesChange={setAttachments}
        maxAttachments={maxAttachments}
        maxTotalAttachmentSizeBytes={maxTotalAttachmentSizeBytes}
      />
    </div>
  )
}
