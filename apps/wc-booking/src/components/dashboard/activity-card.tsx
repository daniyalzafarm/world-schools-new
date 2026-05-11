'use client'

import Link from 'next/link'
import React from 'react'

interface ActivityCardProps {
  icon: React.ReactNode
  count: number
  label: string
  href: string
  tone?: 'primary' | 'warning' | 'default'
}

const TONES: Record<NonNullable<ActivityCardProps['tone']>, string> = {
  primary: 'bg-primary-50 text-primary-700',
  warning: 'bg-warning-50 text-warning-300',
  default: 'bg-default-100 text-foreground',
}

export function ActivityCard({ icon, count, label, href, tone = 'primary' }: ActivityCardProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-default-200 bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{count}</p>
        <p className="text-sm text-default-500">{label}</p>
      </div>
    </Link>
  )
}
