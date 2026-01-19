'use client'

import { Chip } from '@heroui/react'

interface SessionStatusBadgeProps {
  isActive: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Session Status Badge Component
 * Displays Active/Inactive status with color coding
 */
export function SessionStatusBadge({ isActive, size = 'sm' }: SessionStatusBadgeProps) {
  return (
    <Chip
      size={size}
      variant="flat"
      color={isActive ? 'success' : 'default'}
      className={`font-semibold ${
        isActive
          ? 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300'
          : 'bg-default-200 text-default-600 dark:bg-default-800 dark:text-default-400'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </Chip>
  )
}
