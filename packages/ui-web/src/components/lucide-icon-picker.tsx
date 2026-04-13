'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@heroui/react'
import { icons, Shapes } from 'lucide-react'
import { cn } from '../utils/cn'
import { createPortal } from 'react-dom'

type LucideIconName = keyof typeof icons

export interface LucideIconPickerProps {
  /** Current icon name (controlled mode) */
  value?: string
  /** Callback when icon is selected */
  onChange?: (iconName: string) => void
  /** Label for the picker */
  label?: string
  /** Description text shown below the picker */
  description?: string
  /** Whether the picker is disabled */
  isDisabled?: boolean
  /** Custom class name for the container */
  className?: string
  /** Size of the icon display in the button */
  iconSize?: number
  /** Position of the picker popup */
  pickerPosition?: 'top' | 'bottom' | 'left' | 'right'
  /** Custom class names for internal elements */
  classNames?: {
    container?: string
    label?: string
    button?: string
    description?: string
  }
  /** Whether the picker is required */
  isRequired?: boolean
  /** Render the popup in a portal to avoid clipping by parents */
  portal?: boolean
}

const POPUP_WIDTH = 320
const POPUP_HEIGHT = 400
const ICONS_PER_PAGE = 120

const pickerPositionClasses = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2',
  right: 'left-full ml-2',
}

// All icon entries cached at module level
const ALL_ICON_ENTRIES = Object.entries(icons) as [LucideIconName, (typeof icons)[LucideIconName]][]

export function LucideIconPicker({
  value,
  onChange,
  label,
  description,
  isDisabled = false,
  className,
  iconSize = 20,
  pickerPosition = 'bottom',
  classNames,
  isRequired = false,
  portal = true,
}: LucideIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return ALL_ICON_ENTRIES
    const q = search.toLowerCase().replace(/[\s-_]+/g, '')
    return ALL_ICON_ENTRIES.filter(([name]) =>
      name
        .toLowerCase()
        .replace(/[\s-_]+/g, '')
        .includes(q)
    )
  }, [search])

  const displayedIcons = useMemo(() => filteredIcons.slice(0, ICONS_PER_PAGE), [filteredIcons])

  const CurrentIcon = value ? (icons[value as LucideIconName] ?? null) : null

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
      top = rect.top - POPUP_HEIGHT - gap
      left = rect.left
    } else if (pickerPosition === 'left') {
      top = rect.top
      left = rect.left - POPUP_WIDTH - gap
    } else if (pickerPosition === 'right') {
      top = rect.top
      left = rect.right + gap
    }

    left = Math.min(Math.max(gap, left), Math.max(gap, vw - POPUP_WIDTH - gap))
    top = Math.min(Math.max(gap, top), Math.max(gap, vh - POPUP_HEIGHT - gap))

    setPopupStyle({
      position: 'fixed',
      top,
      left,
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      zIndex: 2147483647,
    })
  }

  useEffect(() => {
    if (!isOpen) return
    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)
    return () => {
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, portal, pickerPosition])

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

  const handleSelect = (iconName: string) => {
    onChange?.(iconName)
    setIsOpen(false)
    setSearch('')
  }

  const handleToggle = () => {
    if (!isDisabled) {
      setIsOpen(open => !open)
    }
  }

  const popup = isOpen ? (
    <div
      ref={popupRef}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900',
        !portal && 'absolute',
        !portal && pickerPositionClasses[pickerPosition],
        !portal && (pickerPosition === 'top' || pickerPosition === 'bottom' ? 'left-0' : 'top-0')
      )}
      style={portal ? popupStyle : { width: POPUP_WIDTH, height: POPUP_HEIGHT }}
    >
      {/* Search */}
      <div className="border-b border-gray-200 p-2 dark:border-gray-700">
        <input
          autoFocus
          type="text"
          placeholder="Search icons..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Icon grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {displayedIcons.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No icons found
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {displayedIcons.map(([name, IconComponent]) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => handleSelect(name)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800',
                  value === name && 'bg-primary/10 ring-1 ring-primary'
                )}
              >
                <IconComponent size={18} className="shrink-0 text-gray-700 dark:text-gray-300" />
                <span className="w-full truncate text-center text-xs text-gray-500 dark:text-gray-400">
                  {name}
                </span>
              </button>
            ))}
          </div>
        )}
        {filteredIcons.length > ICONS_PER_PAGE && (
          <p className="mt-2 text-center text-xs text-gray-400">
            Showing {ICONS_PER_PAGE} of {filteredIcons.length} — refine your search
          </p>
        )}
      </div>
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
          disabled={isDisabled}
          className={cn(
            'h-auto min-h-10 px-3 py-2',
            'rounded-lg bg-white',
            'border border-gray-200',
            'hover:border-gray-300',
            'transition-colors duration-200',
            'dark:bg-gray-800 dark:border-gray-600',
            isOpen && 'border-primary! bg-white!',
            isDisabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900',
            classNames?.button
          )}
        >
          <div className="flex items-center gap-3 justify-start w-full">
            {CurrentIcon ? (
              <CurrentIcon size={iconSize} className="shrink-0 text-gray-700 dark:text-gray-300" />
            ) : (
              <Shapes size={iconSize} className="shrink-0 text-gray-400" />
            )}
            <span className="text-sm text-gray-500">{value ?? 'Select icon'}</span>
          </div>
        </Button>

        {portal
          ? typeof document !== 'undefined'
            ? createPortal(popup, document.body)
            : null
          : popup}
      </div>

      {description && (
        <p className={cn('text-sm text-default-400', 'pt-1 px-1', classNames?.description)}>
          {description}
        </p>
      )}
    </div>
  )
}
