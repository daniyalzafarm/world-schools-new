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

import { useMemo, useState, useRef, useEffect } from 'react'
import { Button } from '@heroui/react'
import { Smile } from 'lucide-react'
import { cn } from '../utils/cn'
import type { EmojiClickData } from 'emoji-picker-react'
import { createPortal } from 'react-dom'

type EmojiPickerReactComponent = typeof import('emoji-picker-react').default

// Dynamically import the emoji picker to avoid SSR issues
// This is lazy-loaded only when the component is used
let Picker: EmojiPickerReactComponent | null = null
const loadPicker = async () => {
  if (!Picker) {
    const module = await import('emoji-picker-react')
    Picker = module.default as EmojiPickerReactComponent
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
  /** Render the popup in a portal to avoid clipping by parents */
  portal?: boolean
}

const emojiSizeClasses = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
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
  portal = true,
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPickerLoaded, setIsPickerLoaded] = useState(false)
  const [PickerComponent, setPickerComponent] = useState<EmojiPickerReactComponent | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const pickerSize = useMemo(() => ({ width: 320, height: 400 }), [])
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})

  // Load the picker component when first opened
  useEffect(() => {
    if (isOpen && !isPickerLoaded) {
      loadPicker().then(component => {
        setPickerComponent(() => component)
        setIsPickerLoaded(true)
      })
    }
  }, [isOpen, isPickerLoaded])

  const updatePopupPosition = () => {
    if (!portal) return
    const anchor = rootRef.current
    if (!anchor) return
    const button = anchor.querySelector('button')
    if (!button) return

    const rect = button.getBoundingClientRect()
    const gap = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = rect.bottom + gap
    let left = rect.left

    if (pickerPosition === 'top') {
      top = rect.top - pickerSize.height - gap
      left = rect.left
    } else if (pickerPosition === 'left') {
      top = rect.top
      left = rect.left - pickerSize.width - gap
    } else if (pickerPosition === 'right') {
      top = rect.top
      left = rect.right + gap
    }

    // Clamp into viewport so it never renders off-screen.
    left = Math.min(Math.max(gap, left), Math.max(gap, vw - pickerSize.width - gap))
    top = Math.min(Math.max(gap, top), Math.max(gap, vh - pickerSize.height - gap))

    setPopupStyle({
      position: 'fixed',
      top,
      left,
      width: pickerSize.width,
      height: pickerSize.height,
      zIndex: 2147483647,
    })
  }

  useEffect(() => {
    if (!isOpen) return
    updatePopupPosition()
    const onScrollOrResize = () => updatePopupPosition()
    window.addEventListener('resize', onScrollOrResize)
    // capture=true to react to scroll on nested containers too
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, portal, pickerPosition, pickerSize.width, pickerSize.height])

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // When portaled, default to document.body — but if a dialog is open, portal
  // *into* the topmost dialog instead. HeroUI/React-Aria's outside-click check
  // is essentially `dialogContent.contains(event.target)`; with the popup in
  // document.body, a click inside it is treated as outside the dialog and the
  // dialog dismisses itself. Portaling inside the dialog keeps `contains` true
  // while `position: fixed` keeps the popup visually anchored to the viewport.
  const portalTarget = useMemo<HTMLElement | null>(() => {
    if (!isOpen || !portal || typeof document === 'undefined') return null
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')
    return dialogs[dialogs.length - 1] ?? document.body
  }, [isOpen, portal])

  const handleEmojiClick = (emojiData: EmojiClickData, _event: MouseEvent) => {
    onChange?.(emojiData.emoji)
    setIsOpen(false)
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(open => !open)
    }
  }

  const popup =
    isOpen && isPickerLoaded && PickerComponent ? (
      <div
        ref={popupRef}
        className={cn(
          !portal && 'absolute',
          !portal && pickerPositionClasses[pickerPosition],
          !portal && (pickerPosition === 'top' || pickerPosition === 'bottom' ? 'left-0' : 'top-0')
        )}
        style={portal ? popupStyle : undefined}
      >
        <PickerComponent
          onEmojiClick={handleEmojiClick}
          width={pickerSize.width}
          height={pickerSize.height}
          previewConfig={{
            showPreview: false,
          }}
          searchPlaceholder="Search emoji..."
          lazyLoadEmojis={true}
        />
      </div>
    ) : null

  return (
    <div className={cn('flex flex-col gap-1', className, classNames?.container)}>
      {label && (
        <label
          className={cn(
            'text-sm font-bold text-foreground',
            'pb-0 will-change-auto origin-top-left transition-all duration-200! ease-out! motion-reduce:transition-none',
            classNames?.label
          )}
        >
          {label}
          {isRequired && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      <div className="relative" ref={rootRef}>
        <Button
          type="button"
          onPress={handleToggle}
          disabled={disabled}
          className={cn(
            'h-10 min-h-10 px-3 py-2',
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

        {portal ? (portalTarget ? createPortal(popup, portalTarget) : null) : popup}
      </div>

      {description && (
        <p className={cn('text-sm text-default-400', 'pt-1 px-1', classNames?.description)}>
          {description}
        </p>
      )}
    </div>
  )
}
