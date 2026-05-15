import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import { UpcomingBookingListItem } from './upcoming-booking-list-item'

interface UpcomingBookingsListProps {
  bookings: ProviderBookingGroupSummary[]
  limit?: number
  emptyLabel?: string
}

export function UpcomingBookingsList({
  bookings,
  limit,
  emptyLabel = 'No upcoming bookings.',
}: UpcomingBookingsListProps) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-default-200 bg-default-50 p-6 text-center text-sm text-default-500">
        {emptyLabel}
      </div>
    )
  }

  const shown = limit ? bookings.slice(0, limit) : bookings

  return (
    <div className="grid grid-cols-1 gap-3">
      {shown.map(b => (
        <UpcomingBookingListItem key={b.id} booking={b} />
      ))}
    </div>
  )
}
