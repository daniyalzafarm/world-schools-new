'use client'

import React from 'react'
import { getGreetingLabel, getTimeOfDayGreeting } from '@/utils/provider-dashboard'

interface GreetingHeaderProps {
  businessName: string | null
  subtitle?: string
  trailing?: React.ReactNode
}

export function GreetingHeader({ businessName, subtitle, trailing }: GreetingHeaderProps) {
  const greeting = getGreetingLabel(getTimeOfDayGreeting())

  return (
    <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          {greeting}
          {businessName ? `, ${businessName}` : ''}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-default-500 sm:text-base">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </header>
  )
}
