import React from 'react'
import { cn } from '@world-schools/ui-web'

type ActivityTone = 'primary' | 'warning' | 'success' | 'default'

const DOT_TONES: Record<ActivityTone, string> = {
  primary: 'bg-primary-500',
  warning: 'bg-warning-500',
  success: 'bg-success-500',
  default: 'bg-default-400',
}

interface ActivityFeedItemProps {
  title: string
  description?: string
  timestamp: string
  tone?: ActivityTone
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime()
    const now = Date.now()
    const diff = Math.max(0, now - then)
    const minutes = Math.round(diff / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function ActivityFeedItem({
  title,
  description,
  timestamp,
  tone = 'primary',
}: ActivityFeedItemProps) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', DOT_TONES[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-default-500">{description}</p>}
        <p className="mt-0.5 text-xs text-default-400">{formatRelative(timestamp)}</p>
      </div>
    </li>
  )
}
