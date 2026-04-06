'use client'

import React from 'react'
import Image from 'next/image'
import { cn } from '@world-schools/ui-web'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useOnboardingStore } from '@/stores/onboarding-store'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { status } = useOnboardingStore()

  // Determine if logo should be clickable
  // Only clickable for approved providers or non-authenticated users
  const isClickable = !isAuthenticated || status?.approvalStatus === 'approved'

  const handleClick = () => {
    if (!isClickable) return

    if (isAuthenticated && status?.approvalStatus === 'approved') {
      router.push('/dashboard')
    } else {
      router.push('/')
    }
  }

  const iconSizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }

  const iconSizes = {
    sm: 30,
    md: 32,
    lg: 36,
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center',
        isClickable ? 'cursor-pointer' : 'cursor-default opacity-90',
        className,
        size == 'lg' ? 'gap-2' : 'gap-2'
      )}
      title={isClickable ? (isAuthenticated ? 'Go to Dashboard' : 'Go to Home') : undefined}
    >
      {/* Logo Icon */}
      <Image
        src="/assets/world-camps-icon-rounded.png"
        alt="World Camps"
        width={iconSizes[size]}
        height={iconSizes[size]}
        className={cn('object-contain', iconSizeClasses[size])}
        style={{ width: 'auto' }}
      />

      {/* Logo Text */}
      {showText && (
        <p
          className={cn(
            'font-bold tracking-tight text-secondary text-nowrap',
            textSizeClasses[size]
          )}
        >
          World Camps
        </p>
      )}
    </div>
  )
}
