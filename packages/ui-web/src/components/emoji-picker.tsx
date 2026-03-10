/**
 * EmojiPicker Component
 *
 * A reusable emoji picker component for selecting emojis across World Schools applications.
 * Features SSR compatibility for Next.js apps and supports both controlled and uncontrolled usage.
 *
 * @example
 * ```typescript
 * import { EmojiPicker } from '@world-schools/ui-web'
 *
 * function MyForm() {
 *   const [emoji, setEmoji] = useState('🎾')
 *
 *   return (
 *     <EmojiPicker
 *       value={emoji}
 *       onChange={setEmoji}
 *       label="Select Icon"
 *     />
 *   )
 * }
 * ```
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@heroui/react'
import { Smile } from 'lucide-react'
import { cn } from '../utils/cn'
import type { EmojiClickData } from 'emoji-picker-react'

// Dynamically import the emoji picker to avoid SSR issues
// This is lazy-loaded only when the component is used
let Picker: any = null
const loadPicker = async () => {
  if (!Picker) {
    const module = await import('emoji-picker-react')
    Picker = module.default
  }
  return Picker
}

export interface EmojiPickerProps {
  /** Current emoji value (controlled mode) */
  value?: string
  /** Callback when emoji is selected */
  onChange?: (emoji: string) => void
  /** Label for the picker */
  label?: string
  /** Description text shown below the picker */
  description?: string
  /** Whether the picker is disabled */
  disabled?: boolean
  /** Custom class name for the container */
  className?: string
  /** Size of the emoji display */
  emojiSize?: 'sm' | 'md' | 'lg'
  /** Position of the picker popup */
  pickerPosition?: 'top' | 'bottom' | 'left' | 'right'
  /** Custom class names for internal elements */
  classNames?: {
    container?: string
    label?: string
    button?: string
    emoji?: string
    description?: string
  }
  /** Whether the picker is required */
  isRequired?: boolean
}

const emojiSizeClasses = {
  sm: 'text-[20px]',
  md: 'text-[24px]',
  lg: 'text-[32px]',
}

const pickerPositionClasses = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2',
  right: 'left-full ml-2',
}

export function EmojiPicker({
  value = '🎾',
  onChange,
  label,
  description,
  disabled = false,
  className,
  emojiSize = 'md',
  pickerPosition = 'bottom',
  classNames,
  isRequired = false,
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPickerLoaded, setIsPickerLoaded] = useState(false)
  const [PickerComponent, setPickerComponent] = useState<any>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Load the picker component when first opened
  useEffect(() => {
    if (isOpen && !isPickerLoaded) {
      loadPicker().then(component => {
        setPickerComponent(() => component)
        setIsPickerLoaded(true)
      })
    }
  }, [isOpen, isPickerLoaded])

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onChange?.(emojiData.emoji)
    setIsOpen(false)
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className={cn('flex flex-col gap-1', className, classNames?.container)}>
      {label && (
        <label
          className={cn(
            'text-[14px] font-bold text-foreground',
            'pb-0 will-change-auto origin-top-left transition-all duration-200! ease-out! motion-reduce:transition-none',
            classNames?.label
          )}
        >
          {label}
          {isRequired && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      <div className="relative" ref={pickerRef}>
        <Button
          type="button"
          onPress={handleToggle}
          disabled={disabled}
          className={cn(
            'h-auto min-h-10 px-3 py-2',
            'rounded-lg bg-white',
            'border border-gray-200',
            'hover:border-gray-300',
            'transition-colors duration-200',
            'dark:bg-gray-800 dark:border-gray-600',
            isOpen && 'border-primary! bg-white!',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900',
            classNames?.button
          )}
        >
          <div className="flex items-center gap-3 justify-start w-full">
            <span className={cn(emojiSizeClasses[emojiSize], classNames?.emoji)}>{value}</span>
            <Smile size={18} className="text-gray-400" />
          </div>
        </Button>

        {isOpen && isPickerLoaded && PickerComponent && (
          <div
            className={cn(
              'absolute z-50',
              pickerPositionClasses[pickerPosition],
              pickerPosition === 'top' || pickerPosition === 'bottom' ? 'left-0' : 'top-0'
            )}
          >
            <PickerComponent
              onEmojiClick={handleEmojiClick}
              width={320}
              height={400}
              previewConfig={{
                showPreview: false,
              }}
              searchPlaceHolder="Search emoji..."
              lazyLoadEmojis={true}
            />
          </div>
        )}
      </div>

      {description && (
        <p className={cn('text-[13px] text-default-400', 'pt-1 px-1', classNames?.description)}>
          {description}
        </p>
      )}
    </div>
  )
}
