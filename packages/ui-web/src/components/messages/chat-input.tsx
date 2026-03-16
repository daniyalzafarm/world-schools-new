'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Textarea } from '@heroui/react'
import { ArrowUp, Paperclip, X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  helpText?: boolean
  className?: string
  isLarge?: boolean
  fullWidth?: boolean
  /** Optional list of files currently attached to the message. */
  attachments?: File[]
  /** Called whenever the attachment list should change. */
  onFilesChange?: (files: File[]) => void
  /** Maximum number of files that can be attached to a single message. */
  maxAttachments?: number
  /** Maximum combined size of all attachments in bytes. */
  maxTotalAttachmentSizeBytes?: number
}

export function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = 'How can I help you today?',
  helpText = true,
  disabled = false,
  isLarge = false,
  fullWidth = false,
  className,
  attachments,
  onFilesChange,
  maxAttachments = 10,
  maxTotalAttachmentSizeBytes = 100 * 1024 * 1024,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const shouldRefocusAfterSendRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const setTextareaNode = useCallback((node: unknown) => {
    // HeroUI's Textarea may forward refs to a wrapper; ensure we capture the real <textarea>.
    const el = node as HTMLElement | HTMLTextAreaElement | null
    if (!el) {
      textareaRef.current = null
      return
    }
    const inner =
      el instanceof HTMLTextAreaElement
        ? el
        : (el.querySelector?.('textarea') as HTMLTextAreaElement | null)
    textareaRef.current = inner ?? null
  }, [])

  const focusTextarea = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) {
        shouldRefocusAfterSendRef.current = true
        onSend()
      }
    }
  }

  const handleSend = () => {
    if (canSend) {
      shouldRefocusAfterSendRef.current = true
      onSend()
    }
  }

  // Auto-focus the input when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // After a successful "send" initiated from this input, the parent clears `value`.
  // Refocus once the cleared value has been rendered to avoid losing focus during rerenders.
  useEffect(() => {
    if (disabled) return
    if (!shouldRefocusAfterSendRef.current) return
    if (value !== '') return
    shouldRefocusAfterSendRef.current = false
    focusTextarea()
  }, [value, disabled, focusTextarea])

  const canSend = (value.trim().length > 0 || (attachments && attachments.length > 0)) && !disabled

  const handleFileButtonClick = () => {
    if (disabled || !onFilesChange) return
    fileInputRef.current?.click()
  }

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = event => {
    if (!onFilesChange) return
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const existing = attachments ?? []
    let next = [...existing, ...files]

    if (maxAttachments && next.length > maxAttachments) {
      next = next.slice(0, maxAttachments)
      setAttachmentError(`You can attach up to ${maxAttachments} files per message.`)
    } else {
      setAttachmentError(null)
    }

    const totalSize = next.reduce((sum, f) => sum + f.size, 0)
    if (maxTotalAttachmentSizeBytes && totalSize > maxTotalAttachmentSizeBytes) {
      setAttachmentError(
        `Total attachment size exceeds ${(maxTotalAttachmentSizeBytes / (1024 * 1024)).toFixed(0)}MB.`
      )
      // Do not update attachments if over total limit
      event.target.value = ''
      return
    }

    onFilesChange(next)
    event.target.value = ''
  }

  const handleRemoveAttachment = (index: number) => {
    if (!onFilesChange || !attachments) return
    const next = attachments.filter((_, i) => i !== index)
    onFilesChange(next)
    if (!next.length) {
      setAttachmentError(null)
    }
  }

  return (
    <div
      className={cn(
        'sticky bottom-0 bg-white dark:bg-gray-900/95 backdrop-blur-md',
        'py-4 mx-5 md:mx-0',
        className
      )}
    >
      <div
        className={`w-full ${!isLarge && !fullWidth ? 'md:w-[80%]' : ''} ${fullWidth ? 'px-16' : ''} mx-auto`}
      >
        <div className="relative max-h-40 flex items-end gap-3 bg-white shadow dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-2">
          {onFilesChange && (
            <div className="self-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                // Approximate backend allow-list; backend remains source of truth.
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed,audio/*,video/*"
              />
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleFileButtonClick}
                disabled={disabled}
                className="shrink-0 text-gray-500 dark:text-gray-300"
                aria-label="Attach files"
              >
                <Paperclip size={16} />
              </Button>
            </div>
          )}
          <Textarea
            ref={setTextareaNode as any}
            value={value}
            onValueChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            minRows={1}
            maxRows={6}
            classNames={{
              base: `flex-1 ${isLarge ? 'h-20' : ''}`,
              input: cn(
                'resize-none bg-transparent border-0 focus:ring-0 text-sm',
                'placeholder:text-gray-500 dark:placeholder:text-gray-400',
                'text-gray-900 dark:text-gray-100'
              ),
              inputWrapper: cn(
                'bg-transparent shadow-none border-0',
                'group-data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent',
                'data-[focus=true]:ring-0 data-[focus=true]:ring-offset-0'
              ),
            }}
          />

          <Button
            isIconOnly
            size="sm"
            onMouseDown={e => {
              // Prevent the button from taking focus away from the textarea on click
              e.preventDefault()
            }}
            onPress={handleSend}
            disabled={!canSend}
            className={cn(
              'w-8 h-8 rounded-full shrink-0 transition-all duration-200',
              canSend
                ? 'bg-secondary text-primary-foreground hover:bg-secondary/90'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            <ArrowUp className="text-white" size={16} />
          </Button>
        </div>

        {attachments && attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <span className="max-w-[180px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(index)}
                  className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-100"
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachmentError && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">{attachmentError}</p>
        )}

        {/* Helper text */}
        {helpText && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  )
}
