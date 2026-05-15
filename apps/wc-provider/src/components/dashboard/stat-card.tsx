'use client'

import Link from 'next/link'
import React from 'react'
import { cn } from '@world-schools/ui-web'

type StatTone = 'primary' | 'warning' | 'success' | 'danger' | 'default'

const TONES: Record<StatTone, string> = {
  primary: 'bg-primary-50 text-primary-700',
  warning: 'bg-warning-50 text-warning-600',
  success: 'bg-success-50 text-success-600',
  danger: 'bg-danger-50 text-danger-600',
  default: 'bg-default-100 text-foreground',
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  hint?: string
  tone?: StatTone
  href?: string
}

export function StatCard({ icon, label, value, hint, tone = 'primary', href }: StatCardProps) {
  const className = cn(
    'flex flex-col gap-3 rounded-2xl border border-default-200 bg-background p-5 transition-all',
    href && 'hover:-translate-y-0.5 hover:border-foreground hover:shadow-md'
  )

  const content = (
    <>
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          TONES[tone]
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-default-500">{label}</p>
        {hint && <p className="mt-1 text-xs text-default-400">{hint}</p>}
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }
  return <div className={className}>{content}</div>
}
