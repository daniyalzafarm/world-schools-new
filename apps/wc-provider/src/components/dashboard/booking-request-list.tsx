import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import { BookingRequestListItem } from './booking-request-list-item'

interface BookingRequestListProps {
  requests: ProviderBookingGroupSummary[]
  limit?: number
  emptyLabel?: string
}

export function BookingRequestList({
  requests,
  limit,
  emptyLabel = 'No pending requests.',
}: BookingRequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-default-200 bg-default-50 p-6 text-center text-sm text-default-500">
        {emptyLabel}
      </div>
    )
  }

  const shown = limit ? requests.slice(0, limit) : requests

  return (
    <div className="grid grid-cols-1 gap-3">
      {shown.map(r => (
        <BookingRequestListItem key={r.id} request={r} />
      ))}
    </div>
  )
}
