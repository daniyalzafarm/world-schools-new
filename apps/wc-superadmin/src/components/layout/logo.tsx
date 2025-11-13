'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'

const SIZE_MAP = {
  sm: 'text-base px-2 py-1 rounded-lg',
  md: 'text-lg px-3 py-1.5 rounded-xl',
  lg: 'text-xl px-4 py-2 rounded-2xl',
} as const

interface LogoProps {
  size?: keyof typeof SIZE_MAP
  showWordmark?: boolean
  className?: string
}

export function Logo({ size = 'md', showWordmark = true, className }: LogoProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push('/analytics-dashboard')}
      className={cn(
        'flex items-center gap-2 text-primary-dark bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur transition hover:border-primary hover:shadow-md',
        SIZE_MAP[size],
        className
      )}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white font-semibold shadow-lg">
        WC
      </span>
      {showWordmark && (
        <span className="flex flex-col text-left leading-tight">
          <span className="font-semibold">World Camps</span>
          <span className="text-xs text-secondary-500 uppercase tracking-[0.18em]">Superadmin</span>
        </span>
      )}
    </button>
  )
}
