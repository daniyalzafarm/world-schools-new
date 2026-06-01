import type { Session } from '@/types/sessions'
import { SessionStatusCard } from './session-status-card'

interface SessionStatusListProps {
  sessions: Session[]
  badgeLabel: string
  statusLabel?: string
  manageHref?: string
  /** Provider settlement currency (ISO 4217). Required. */
  currency: string
  limit?: number
  emptyLabel?: string
}

export function SessionStatusList({
  sessions,
  badgeLabel,
  statusLabel,
  manageHref,
  currency,
  limit,
  emptyLabel = 'No sessions yet.',
}: SessionStatusListProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-default-200 bg-default-50 p-6 text-center text-sm text-default-500">
        {emptyLabel}
      </div>
    )
  }

  const shown = limit ? sessions.slice(0, limit) : sessions

  return (
    <div className="grid grid-cols-1 gap-3">
      {shown.map(s => (
        <SessionStatusCard
          key={s.id}
          session={s}
          badgeLabel={badgeLabel}
          statusLabel={statusLabel}
          manageHref={manageHref}
          currency={currency}
        />
      ))}
    </div>
  )
}
