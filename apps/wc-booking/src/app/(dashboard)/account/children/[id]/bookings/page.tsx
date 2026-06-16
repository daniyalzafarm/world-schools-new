'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Alert, Button, Spinner } from '@heroui/react'
import { BackButton } from '@world-schools/ui-web'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { BookingCard } from '@/components/bookings/booking-card'
import { useChildrenStore } from '@/stores/children-store'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'

export default function ChildBookingsPage() {
  const params = useParams()
  const childId = params.id as string

  const children = useChildrenStore(state => state.children)
  const isChildrenLoading = useChildrenStore(state => state.isLoading)
  const fetchChildren = useChildrenStore(state => state.fetchChildren)

  // Resolve the child's name on deep-links/reloads where the store is empty.
  useEffect(() => {
    if (children.length === 0 && !isChildrenLoading) {
      fetchChildren().catch(() => undefined)
    }
  }, [children.length, isChildrenLoading, fetchChildren])

  const child = children.find(c => c.id === childId)
  const childName = child?.nickname || child?.firstName

  const [items, setItems] = useState<ParentBookingGroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await bookingGroupsService.list({ childId, tab: 'upcoming', limit: 50 })
    if (res.success && res.data) {
      setItems(Array.isArray(res.data) ? res.data : [])
    } else {
      setItems([])
      setError((res.data as { message?: string })?.message ?? 'Could not load bookings.')
    }
    setLoading(false)
  }, [childId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <BackButton />
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {childName ? `${childName}'s Bookings` : 'Bookings'}
          </h1>
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">
          Upcoming and confirmed camp bookings
        </p>
      </div>

      {error ? (
        <Alert
          color="danger"
          variant="flat"
          title="Something went wrong"
          description={error}
          endContent={
            <Button size="sm" variant="flat" onPress={load}>
              Retry
            </Button>
          }
        />
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" color="primary" label="Loading bookings" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 px-6 py-16 text-center">
          <p className="text-lg font-medium text-secondary">No upcoming bookings</p>
          <p className="mt-2 text-sm text-default-600">
            Upcoming camps for {childName ?? 'this child'} will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map(row => (
            <BookingCard key={row.id} row={row} onDraftDeleted={load} />
          ))}
        </div>
      )}

      {/* Past bookings pointer (mirrors the design's Past Bookings divider) */}
      <p className="pt-2 text-sm text-default-500">
        Looking for past camps?{' '}
        <Link
          href={`/account/children/${childId}/history`}
          className="font-medium text-primary-600 hover:underline"
        >
          View {childName ? `${childName}'s` : 'this child’s'} camp history
        </Link>
        .
      </p>
    </div>
  )
}
