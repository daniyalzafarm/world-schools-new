'use client'

import React from 'react'
import { Avatar } from '@heroui/react'
import { cn } from '../utils/cn'
import { getInitials } from '../utils'

export type UserAvatarVariant = 'gradient' | 'flat'

export interface UserAvatarProps {
  photoUrl?: string | null
  fullName?: string | null
  variant?: UserAvatarVariant
  className?: string
}

const FALLBACK_VARIANT_CLASSES: Record<UserAvatarVariant, string> = {
  gradient: 'bg-linear-to-br from-primary-100 to-secondary-50 text-secondary dark:text-white',
  flat: 'bg-primary text-secondary',
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  fullName,
  variant = 'gradient',
  className,
}) => {
  const displayName = fullName?.trim() || 'User'
  const initials = getInitials(fullName)
  const sizeClasses = className ?? 'w-24 h-24 text-3xl'

  if (photoUrl) {
    return (
      <div className="shrink-0">
        <Avatar alt={displayName} src={photoUrl} name={displayName} className={sizeClasses} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold shrink-0',
        FALLBACK_VARIANT_CLASSES[variant],
        sizeClasses
      )}
    >
      {initials}
    </div>
  )
}
