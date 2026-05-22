'use client'

import type { ReactNode } from 'react'

interface ProgressRowProps {
  label: ReactNode
  value: ReactNode
  percent: number
  colorClass?: string
}

export function ProgressRow({
  label,
  value,
  percent,
  colorClass = 'bg-primary-500',
}: ProgressRowProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="truncate text-default-700 dark:text-default-200">{label}</div>
        <div className="font-semibold text-default-700 dark:text-default-200">{value}</div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-default-200 dark:bg-default-700/50">
        <div
          className={`h-full rounded-full ${colorClass} transition-all`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
