import { cn } from '@world-schools/ui-web'
import type { Session } from '@/types/sessions'

interface SessionCapacityBarProps {
  session: Session
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start)
    const e = new Date(end)
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
    const sMonth = s.toLocaleString('en', { month: 'short' })
    const eMonth = e.toLocaleString('en', { month: 'short' })
    if (sameMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`
  } catch {
    return ''
  }
}

export function SessionCapacityBar({ session }: SessionCapacityBarProps) {
  const total = session.totalSpots ?? 0
  const booked = session.bookedCount ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0

  const fillTone =
    pct >= 90
      ? 'bg-danger-500'
      : pct >= 60
        ? 'bg-warning-500'
        : pct > 0
          ? 'bg-primary-500'
          : 'bg-default-300'

  return (
    <div className="rounded-2xl border border-default-200 bg-background p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{session.name}</p>
          <p className="text-xs text-default-500">
            {formatRange(session.startDate, session.endDate)}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-foreground">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-default-200">
        <div
          className={cn('h-full rounded-full transition-all', fillTone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-default-500">
        {booked} / {total > 0 ? total : '—'} {total === 1 ? 'spot' : 'spots'}
      </p>
    </div>
  )
}
