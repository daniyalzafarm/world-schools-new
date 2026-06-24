'use client'

import type { KeyboardEvent, ReactNode } from 'react'

interface RankedListRowProps {
  rank: number
  primary: ReactNode
  secondary?: ReactNode
  right?: ReactNode
  avatar?: ReactNode
  onClick?: () => void
}

const MEDAL_CLASSES: Record<number, string> = {
  1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  2: 'bg-gray-200 text-gray-700 dark:bg-gray-700/50 dark:text-gray-200',
  3: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

export function RankedListRow({
  rank,
  primary,
  secondary,
  right,
  avatar,
  onClick,
}: RankedListRowProps) {
  const medalClass = MEDAL_CLASSES[rank] ?? 'bg-default-100 text-default-600 dark:bg-default-700/50'
  const interactive = Boolean(onClick)
  return (
    <div
      {...(interactive
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            },
          }
        : {})}
      className={`flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-default-50 dark:hover:bg-default-900/40${
        interactive
          ? ' cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          : ''
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${medalClass}`}
      >
        {rank}
      </div>
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{primary}</div>
        {secondary && <div className="truncate text-xs text-default-500">{secondary}</div>}
      </div>
      {right && <div className="shrink-0 text-right text-sm font-semibold">{right}</div>}
    </div>
  )
}

interface RankedListProps {
  children: ReactNode
  className?: string
}

export function RankedList({ children, className = '' }: RankedListProps) {
  return <div className={`flex flex-col gap-1 ${className}`}>{children}</div>
}
