'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, Button, Chip, Pagination, Spinner, Tab, Tabs } from '@heroui/react'
import {
  PARENT_BOOKING_TABS,
  type ParentBookingGroupsListMeta,
  type ParentBookingTab,
} from '@world-schools/wc-types'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { BookingCard } from '@/components/bookings/booking-card'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'

const PAGE_SIZE = 10
const DEFAULT_TAB: ParentBookingTab = 'upcoming'

const EMPTY_TAB_COUNTS: ParentBookingGroupsListMeta['tabCounts'] = {
  drafts: 0,
  upcoming: 0,
  past: 0,
  cancelled: 0,
}

function isValidTab(value: string | null): value is ParentBookingTab {
  return value != null && (PARENT_BOOKING_TABS as readonly string[]).includes(value)
}

export default function BookingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawTab = searchParams.get('tab')
  const tab: ParentBookingTab = isValidTab(rawTab) ? rawTab : DEFAULT_TAB
  const rawPage = Number(searchParams.get('page'))
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1

  const [items, setItems] = useState<ParentBookingGroupSummary[]>([])
  const [meta, setMeta] = useState<ParentBookingGroupsListMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    tabCounts: EMPTY_TAB_COUNTS,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSubmittedBanner, setShowSubmittedBanner] = useState(false)

  useEffect(() => {
    if (searchParams.get('submitted') === '1') {
      setShowSubmittedBanner(true)
      const next = new URLSearchParams(searchParams.toString())
      next.delete('submitted')
      const q = next.toString()
      router.replace(q ? `/bookings?${q}` : '/bookings', { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    if (rawTab != null && !isValidTab(rawTab)) {
      router.replace('/bookings', { scroll: false })
    }
  }, [rawTab, router])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await bookingGroupsService.list({ tab, page, limit: PAGE_SIZE })
    if (res.success && res.data) {
      setItems(Array.isArray(res.data) ? res.data : [])
      const responseMeta = (res as unknown as { meta?: ParentBookingGroupsListMeta }).meta
      if (responseMeta) {
        setMeta(responseMeta)
        if (responseMeta.totalPages > 0 && page > responseMeta.totalPages) {
          const params = new URLSearchParams()
          if (tab !== DEFAULT_TAB) params.set('tab', tab)
          params.set('page', String(responseMeta.totalPages))
          router.replace(`/bookings?${params.toString()}`, { scroll: false })
        }
      }
    } else {
      setItems([])
      setError((res.data as { message?: string })?.message ?? 'Could not load bookings.')
    }
    setLoading(false)
  }, [tab, page, router])

  useEffect(() => {
    void load()
  }, [load])

  const setTab = useCallback(
    (nextTab: ParentBookingTab) => {
      if (nextTab === tab) return
      const params = new URLSearchParams()
      if (nextTab !== DEFAULT_TAB) params.set('tab', nextTab)
      const q = params.toString()
      router.replace(q ? `/bookings?${q}` : '/bookings', { scroll: false })
    },
    [router, tab]
  )

  const setPage = useCallback(
    (nextPage: number) => {
      if (nextPage === page) return
      const params = new URLSearchParams()
      if (tab !== DEFAULT_TAB) params.set('tab', tab)
      if (nextPage > 1) params.set('page', String(nextPage))
      const q = params.toString()
      router.replace(q ? `/bookings?${q}` : '/bookings', { scroll: false })
    },
    [router, tab, page]
  )

  const subtitle = useMemo(() => {
    const upcomingCount = meta.tabCounts.upcoming
    if (upcomingCount === 0) return 'View and manage your camp bookings'
    return `${upcomingCount} upcoming booking${upcomingCount === 1 ? '' : 's'}`
  }, [meta.tabCounts.upcoming])

  const emptyCopy = useMemo(() => {
    switch (tab) {
      case 'drafts':
        return {
          title: 'No draft bookings',
          body: 'Incomplete bookings you start will appear here until you submit them.',
        }
      case 'past':
        return {
          title: 'No past bookings',
          body: 'Bookings you complete will show up here.',
        }
      case 'cancelled':
        return {
          title: 'No cancelled bookings',
          body: 'Bookings you cancel will show up here.',
        }
      default:
        return {
          title: 'No upcoming bookings',
          body: 'Explore camps and start a booking request.',
        }
    }
  }, [tab])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-secondary">My Bookings</h1>
        <p className="mt-1 text-default-600">{subtitle}</p>
      </header>

      {showSubmittedBanner ? (
        <Alert
          color="success"
          variant="flat"
          title="Booking request submitted"
          description="The camp will review your request. You'll see updates here."
          isClosable
          onClose={() => setShowSubmittedBanner(false)}
        />
      ) : null}

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

      <Tabs
        aria-label="Booking categories"
        selectedKey={tab}
        onSelectionChange={key => setTab(key as ParentBookingTab)}
        variant="underlined"
        classNames={{
          base: 'w-full border-b border-divider',
          tab: 'w-36 px-0!',
          tabList: 'p-0!',
        }}
      >
        <Tab
          key="upcoming"
          title={
            <span className="flex items-center gap-1.5">
              Upcoming
              {meta.tabCounts.upcoming > 0 ? (
                <Chip size="sm" color="secondary">
                  {meta.tabCounts.upcoming}
                </Chip>
              ) : null}
            </span>
          }
        />
        <Tab
          key="drafts"
          title={
            <span className="flex items-center gap-1.5">
              Drafts
              {meta.tabCounts.drafts > 0 ? (
                <Chip size="sm" color="secondary">
                  {meta.tabCounts.drafts}
                </Chip>
              ) : null}
            </span>
          }
        />
        <Tab
          key="past"
          title={
            <span className="flex items-center gap-1.5">
              Past
              {meta.tabCounts.past > 0 ? (
                <Chip size="sm" color="secondary">
                  {meta.tabCounts.past}
                </Chip>
              ) : null}
            </span>
          }
        />
        <Tab
          key="cancelled"
          title={
            <span className="flex items-center gap-1.5">
              Cancelled
              {meta.tabCounts.cancelled > 0 ? (
                <Chip size="sm" color="secondary">
                  {meta.tabCounts.cancelled}
                </Chip>
              ) : null}
            </span>
          }
        />
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" color="primary" label="Loading bookings" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 px-6 py-16 text-center">
          <p className="text-lg font-medium text-secondary">{emptyCopy.title}</p>
          <p className="mt-2 text-sm text-default-600">{emptyCopy.body}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map(row => (
            <BookingCard key={row.id} row={row} onDraftDeleted={load} />
          ))}
          {meta.totalPages > 1 ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-default-500">
                Showing {items.length} of {meta.total}
              </span>
              <Pagination
                total={meta.totalPages}
                page={meta.page}
                onChange={setPage}
                showControls
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
