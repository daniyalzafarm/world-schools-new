'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { Button, Textarea } from '@heroui/react'
import { ArrowUp } from 'lucide-react'
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
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const shouldRefocusAfterSendRef = useRef(false)

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
      if (value.trim() && !disabled) {
        shouldRefocusAfterSendRef.current = true
        onSend()
      }
    }
  }

  const handleSend = () => {
    if (value.trim() && !disabled) {
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

  const canSend = value.trim().length > 0 && !disabled

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
