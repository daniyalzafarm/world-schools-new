'use client'

import React from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { getGreetingLabel, getTimeOfDayGreeting } from '@/utils/dashboard'

interface GreetingHeaderProps {
  subtitle?: string
  trailing?: React.ReactNode
}

export function GreetingHeader({ subtitle, trailing }: GreetingHeaderProps) {
  const { user } = useAuthStore()
  const greeting = getGreetingLabel(getTimeOfDayGreeting())
  const firstName = user?.firstName ?? ''

  return (
    <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-default-500 sm:text-base">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </header>
  )
}
