import type { Session } from '@/types/sessions'
import { SessionCapacityBar } from './session-capacity-bar'

interface SessionCapacityListProps {
  sessions: Session[]
  limit?: number
  emptyLabel?: string
}

export function SessionCapacityList({
  sessions,
  limit,
  emptyLabel = 'No sessions yet.',
}: SessionCapacityListProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-default-200 bg-default-50 p-6 text-center text-sm text-default-500">
        {emptyLabel}
      </div>
    )
  }

  const shown = limit ? sessions.slice(0, limit) : sessions

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map(s => (
        <SessionCapacityBar key={s.id} session={s} />
      ))}
    </div>
  )
}
