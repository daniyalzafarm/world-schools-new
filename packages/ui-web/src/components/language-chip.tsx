'use client'

import { cn } from '../utils/cn'

interface LanguageChipProps {
  /**
   * Language label to display
   */
  label: string
  /**
   * Language value
   */
  value: string
  /**
   * Whether the chip is selected
   */
  selected?: boolean
  /**
   * Click handler
   */
  onClick?: () => void
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Disabled state
   */
  disabled?: boolean
}

/**
 * LanguageChip component matching the camp wizard design
 * Features:
 * - Rounded pill shape (20px border radius)
 * - Light border with primary color on hover/selected
 * - Primary light background when selected
 * - Medium font weight
 */
export function LanguageChip({
  label,
  value,
  selected = false,
  onClick,
  className,
  disabled = false,
}: LanguageChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'cursor-pointer inline-flex items-center rounded-full border-2 bg-background px-4 py-2 text-sm font-medium transition-all duration-200',
        selected ? 'border-primary bg-primary-50' : 'border-default-200 hover:border-primary',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {label}
    </button>
  )
}
