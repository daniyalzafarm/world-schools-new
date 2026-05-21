import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import { ActivityFeedItem } from './activity-feed-item'

interface ActivityFeedProps {
  items: {
    id: string
    title: string
    description?: string
    timestamp: string
    tone?: 'primary' | 'warning' | 'success' | 'default'
  }[]
  emptyLabel?: string
}

export function ActivityFeed({ items, emptyLabel = 'No recent activity.' }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-default-200 bg-default-50 p-6 text-center text-sm text-default-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-default-200 rounded-2xl border border-default-200 bg-background px-4">
      {items.map(item => (
        <ActivityFeedItem
          key={item.id}
          title={item.title}
          description={item.description}
          timestamp={item.timestamp}
          tone={item.tone}
        />
      ))}
    </ul>
  )
}

/**
 * Build an activity-feed item list from recent booking groups across all tabs.
 * Sorts by `updatedAt` desc and truncates to `limit`.
 */
export function buildBookingActivity(
  groups: ProviderBookingGroupSummary[],
  limit = 6
): {
  id: string
  title: string
  description?: string
  timestamp: string
  tone: 'primary' | 'warning' | 'success' | 'default'
}[] {
  const TITLES: Record<
    string,
    { title: string; tone: 'primary' | 'warning' | 'success' | 'default' }
  > = {
    request: { title: 'New booking request', tone: 'warning' },
    accepted: { title: 'Booking confirmed', tone: 'primary' },
    deposit_paid: { title: 'Deposit paid', tone: 'success' },
    fully_paid: { title: 'Booking fully paid', tone: 'success' },
    at_camp: { title: 'Booking checked in', tone: 'primary' },
    completed: { title: 'Booking completed', tone: 'default' },
    declined: { title: 'Request declined', tone: 'default' },
    expired: { title: 'Request expired', tone: 'default' },
    cancelled: { title: 'Booking cancelled', tone: 'default' },
    draft: { title: 'Draft created', tone: 'default' },
  }

  return [...groups]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit)
    .map(g => {
      const meta = TITLES[g.status] ?? { title: 'Booking updated', tone: 'default' as const }
      return {
        id: g.id,
        title: meta.title,
        description: `${g.parent.displayName} · ${g.camp.name}`,
        timestamp: g.updatedAt,
        tone: meta.tone,
      }
    })
}
