'use client'

import { Chip } from '@heroui/react'
import { formatCapacity, formatCapacityWithBooked } from '@/utils/sessionFormatters'
import { getCapacityStatus } from '@/utils/sessionCalculations'

interface SessionCapacityIndicatorProps {
  capacity?: number
  booked?: number
  showBooked?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Session Capacity Indicator Component
 * Displays capacity information with color coding based on availability
 */
export function SessionCapacityIndicator({
  capacity,
  booked = 0,
  showBooked = false,
  size = 'sm',
}: SessionCapacityIndicatorProps) {
  const status = getCapacityStatus(capacity, booked)

  // Color coding based on capacity status
  const getColorClass = () => {
    if (capacity === undefined || capacity === null) {
      return 'bg-default-100 text-default-700 dark:bg-default-800 dark:text-default-300'
    }

    switch (status) {
      case 'full':
        return 'bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300'
      case 'almost-full':
        return 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300'
      case 'available':
        return 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300'
      default:
        return 'bg-default-100 text-default-700 dark:bg-default-800 dark:text-default-300'
    }
  }

  const displayText = showBooked
    ? formatCapacityWithBooked(capacity, booked)
    : formatCapacity(capacity)

  return (
    <Chip size={size} variant="flat" className={`font-semibold ${getColorClass()}`}>
      {displayText}
    </Chip>
  )
}
