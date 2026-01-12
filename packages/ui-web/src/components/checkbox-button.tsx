'use client'

import { cn } from '../utils/cn'

interface CheckboxButtonProps {
  /**
   * Unique identifier for the checkbox
   */
  id: string
  /**
   * Value of the checkbox
   */
  value: string
  /**
   * Label text to display
   */
  label: string
  /**
   * Optional description text below the label
   */
  description?: string
  /**
   * Optional icon to display (emoji or component)
   */
  icon?: React.ReactNode
  /**
   * Whether the checkbox is checked
   */
  checked?: boolean
  /**
   * Change handler
   */
  onChange?: (checked: boolean) => void
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
 * CheckboxButton component with chip-like appearance
 * Features:
 * - Rounded pill shape (20px border radius)
 * - Light border with primary color on hover/selected
 * - Primary light background when selected
 * - Optional icon and description support
 * - Consistent with LanguageChip styling
 */
export function CheckboxButton({
  id,
  value,
  label,
  description,
  icon,
  checked = false,
  onChange,
  className,
  disabled = false,
}: CheckboxButtonProps) {
  const handleChange = () => {
    if (!disabled && onChange) {
      onChange(!checked)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        type="checkbox"
        id={id}
        value={value}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="absolute h-0 w-0 opacity-0"
      />
      <label
        htmlFor={id}
        className={cn(
          'flex cursor-pointer items-center gap-2.5 rounded-full border-2 bg-background px-4 py-2 transition-all duration-200',
          checked
            ? 'border-primary bg-primary-50'
            : 'border-default-200 hover:border-primary',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {icon && <div className="shrink-0 text-xl">{icon}</div>}
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{label}</div>
          {description && (
            <div className="mt-0.5 text-[13px] leading-[1.3] text-default-500">{description}</div>
          )}
        </div>
      </label>
    </div>
  )
}

