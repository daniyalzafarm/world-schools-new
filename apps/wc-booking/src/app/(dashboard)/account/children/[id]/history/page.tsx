'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Alert, Button, Spinner } from '@heroui/react'
import { BackButton } from '@world-schools/ui-web'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { BookingCard } from '@/components/bookings/booking-card'
import { useChildrenStore } from '@/stores/children-store'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'

function nightsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

export default function ChildHistoryPage() {
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
    const res = await bookingGroupsService.list({ childId, tab: 'past', limit: 100 })
    if (res.success && res.data) {
      setItems(Array.isArray(res.data) ? res.data : [])
    } else {
      setItems([])
      setError((res.data as { message?: string })?.message ?? 'Could not load camp history.')
    }
    setLoading(false)
  }, [childId])

  useEffect(() => {
    void load()
  }, [load])

  const daysAtCamp = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + nightsBetween(item.session.startDate, item.session.endDate),
        0
      ),
    [items]
  )

  // Bucket completed camps by year (newest first), matching the design's
  // year-section layout.
  const groupedByYear = useMemo(() => {
    const map = new Map<number, ParentBookingGroupSummary[]>()
    for (const item of items) {
      const year = new Date(item.session.startDate).getFullYear()
      const key = Number.isNaN(year) ? 0 : year
      const bucket = map.get(key)
      if (bucket) bucket.push(item)
      else map.set(key, [item])
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [items])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <BackButton />
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {childName ? `${childName}'s Camp History` : 'Camp History'}
          </h1>
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">Past camps and experiences</p>
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
          <Spinner size="lg" color="primary" label="Loading camp history" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 px-6 py-16 text-center">
          <p className="text-lg font-medium text-secondary">No past camps yet</p>
          <p className="mt-2 text-sm text-default-600">
            Completed camps for {childName ?? 'this child'} will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-default-50 p-5 text-center">
              <div className="text-3xl font-bold text-secondary">{items.length}</div>
              <div className="mt-1 text-sm text-default-500">Camps attended</div>
            </div>
            <div className="rounded-xl bg-default-50 p-5 text-center">
              <div className="text-3xl font-bold text-secondary">{daysAtCamp}</div>
              <div className="mt-1 text-sm text-default-500">Days at camp</div>
            </div>
          </div>

          {/* History grouped by year */}
          {groupedByYear.map(([year, rows]) => (
            <div key={year} className="space-y-4">
              <h2 className="border-b border-default-200 pb-2 text-sm font-semibold text-default-500">
                {year || 'Earlier'}
              </h2>
              <div className="flex flex-col gap-4">
                {rows.map(row => (
                  <BookingCard key={row.id} row={row} onDraftDeleted={load} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
