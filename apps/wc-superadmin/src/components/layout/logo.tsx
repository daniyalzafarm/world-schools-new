'use client'

import React from 'react'
import Image from 'next/image'
import { cn } from '@world-schools/ui-web'
import { useRouter } from 'next/navigation'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const router = useRouter()

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
      onClick={() => router.push('/')}
      className={cn(
        'flex items-center cursor-pointer',
        className,
        size == 'lg' ? 'gap-2' : 'gap-2'
      )}
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
