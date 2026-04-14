import React, { useMemo } from 'react'

export interface SlaProgressBarProps {
  /** ISO date string for when the SLA target is/was due. */
  dueAt: string | null | undefined
  /** ISO date string for when the target was achieved (if completed). */
  completedAt?: string | null
  /** Human-readable label, e.g. "First response" or "Resolution". */
  label: string
  /** ISO date string for when the SLA was actually breached (if breached). */
  breachedAt?: string | null
}

/**
 * A compact SLA progress bar showing time remaining / elapsed.
 *
 * Colour transitions:
 *   > 50% remaining   → green
 *   25-50% remaining  → amber
 *   < 25% remaining   → red
 *   overdue / breached → red with "Overdue" label
 *   completed         → green with ✓ checkmark
 */
export function SlaProgressBar({ dueAt, completedAt, label, breachedAt }: SlaProgressBarProps) {
  const state = useMemo(() => {
    if (!dueAt) return null

    const now = Date.now()
    const dueMs = new Date(dueAt).getTime()
    const isBreached = !!breachedAt || now > dueMs
    const isCompleted = !!completedAt

    if (isCompleted) {
      return { type: 'completed' as const, label, dueAt }
    }

    const totalMs =
      dueMs -
      // Estimate ticket age as 24 hours ago if we can't derive it from ticket data
      (dueMs - 86_400_000)
    const remainingMs = dueMs - now
    const pct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))

    let barColor: string
    let textColor: string
    if (isBreached) {
      barColor = 'bg-red-500'
      textColor = 'text-red-600 dark:text-red-400'
    } else if (pct > 50) {
      barColor = 'bg-green-500'
      textColor = 'text-slate-600 dark:text-slate-400'
    } else if (pct > 25) {
      barColor = 'bg-amber-500'
      textColor = 'text-amber-700 dark:text-amber-400'
    } else {
      barColor = 'bg-red-500'
      textColor = 'text-red-600 dark:text-red-400'
    }

    const remainingLabel = formatDuration(Math.abs(remainingMs))
    const statusText = isBreached ? `Overdue by ${remainingLabel}` : `${remainingLabel} left`

    return {
      type: 'pending' as const,
      label,
      pct: isBreached ? 100 : pct,
      barColor,
      textColor,
      statusText,
    }
  }, [dueAt, completedAt, breachedAt, label])

  if (!state) return null

  if (state.type === 'completed') {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
        <span className="font-medium">{state.label}</span>
        <span>✓ Done</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">{state.label}</span>
        <span className={state.textColor}>{state.statusText}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${state.barColor}`}
          style={{ width: `${state.pct}%` }}
        />
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}
