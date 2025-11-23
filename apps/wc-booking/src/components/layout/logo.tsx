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
    sm: 'h-8',
    md: 'h-8',
    lg: 'h-10',
  }

  const textLogoSizeClasses = {
    sm: 'h-5',
    md: 'h-5',
    lg: 'h-8',
  }

  const iconSizes = {
    sm: 32,
    md: 32,
    lg: 36,
  }

  const textLogoSizes = {
    sm: { width: 80, height: 16 },
    md: { width: 120, height: 22 },
    lg: { width: 150, height: 24 },
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
        <Image
          src="/assets/world-camps-dark.png"
          alt="World Camps"
          width={textLogoSizes[size].width}
          height={textLogoSizes[size].height}
          className={cn('object-contain mt-1', textLogoSizeClasses[size])}
          style={{ width: 'auto' }}
        />
      )}
    </div>
  )
}
