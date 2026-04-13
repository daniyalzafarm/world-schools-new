'use client'

import { cn } from '../utils/cn'

interface RadioButtonProps {
  /**
   * Unique identifier for the radio button
   */
  id: string
  /**
   * Name attribute for the radio group
   */
  name: string
  /**
   * Value of the radio button
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
   * Whether the radio button is selected
   */
  checked?: boolean
  /**
   * Change handler
   */
  onChange?: (value: string) => void
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
 * RadioButton component with chip-like appearance
 * Features:
 * - Rounded pill shape (20px border radius)
 * - Light border with primary color on hover/selected
 * - Primary light background when selected
 * - Optional icon and description support
 * - Consistent with LanguageChip styling
 */
export function RadioButton({
  id,
  name,
  value,
  label,
  description,
  icon,
  checked = false,
  onChange,
  className,
  disabled = false,
}: RadioButtonProps) {
  const handleChange = () => {
    if (!disabled && onChange) {
      onChange(value)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        type="radio"
        id={id}
        name={name}
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
          checked ? 'border-primary bg-primary-50' : 'border-default-200 hover:border-primary',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {icon && <div className="shrink-0 text-xl">{icon}</div>}
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{label}</div>
          {description && (
            <div className="mt-0.5 text-sm leading-snug text-default-500">{description}</div>
          )}
        </div>
      </label>
    </div>
  )
}
