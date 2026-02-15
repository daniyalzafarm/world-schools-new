'use client'

import { Chip } from '@heroui/react'
import type { SessionStatus } from '@/types/sessions'

interface SessionStatusBadgeProps {
  status: SessionStatus
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Session Status Badge Component
 * Displays Draft/Published status with color coding
 */
export function SessionStatusBadge({ status, size = 'sm' }: SessionStatusBadgeProps) {
  const isPublished = status === 'published'

  return (
    <Chip
      size={size}
      variant="flat"
      color={isPublished ? 'success' : 'default'}
      className={`font-semibold ${
        isPublished
          ? 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300'
          : 'bg-default-200 text-default-600 dark:bg-default-800 dark:text-default-400'
      }`}
    >
      {isPublished ? 'Published' : 'Draft'}
    </Chip>
  )
}
