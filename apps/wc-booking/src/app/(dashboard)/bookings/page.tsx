'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, Button, Chip, Spinner, Tab, Tabs } from '@heroui/react'
import { bookingGroupsService } from '@/services/booking-groups.services'
import type { ParentBookingGroupStatus, ParentBookingGroupSummary } from '@/types/camp-booking'
import Link from 'next/link'

type BookingsTab = 'upcoming' | 'quotes' | 'past' | 'cancelled'

const UPCOMING_STATUSES: ParentBookingGroupStatus[] = [
  'draft',
  'request',
  'accepted',
  'declined',
  'expired',
  'deposit_paid',
  'fully_paid',
  'at_camp',
]

function statusLabel(status: ParentBookingGroupStatus): string {
  const map: Record<ParentBookingGroupStatus, string> = {
    draft: 'Draft',
    request: 'Pending review',
    accepted: 'Confirmed',
    declined: 'Declined',
    expired: 'Expired',
    deposit_paid: 'Deposit paid',
    fully_paid: 'Fully paid',
    at_camp: 'At camp',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status
}

function statusBadgeClass(status: ParentBookingGroupStatus): string {
  switch (status) {
    case 'request':
    case 'expired':
      return 'bg-warning-100 text-warning-800 border border-warning-200'
    case 'accepted':
    case 'fully_paid':
    case 'at_camp':
      return 'bg-success-500 text-white'
    case 'draft':
      return 'bg-default-100 text-default-700'
    case 'deposit_paid':
      return 'bg-primary-100 text-primary-800'
    case 'declined':
    case 'cancelled':
      return 'bg-danger-100 text-danger-800'
    case 'completed':
      return 'bg-success-100 text-success-800'
    default:
      return 'bg-default-100 text-default-700'
  }
}

function progressPercent(status: ParentBookingGroupStatus): number {
  const map: Record<ParentBookingGroupStatus, number> = {
    draft: 12,
    request: 28,
    accepted: 42,
    declined: 20,
    expired: 25,
    deposit_paid: 58,
    fully_paid: 72,
    at_camp: 88,
    completed: 100,
    cancelled: 0,
  }
  return map[status] ?? 20
}

function progressBarColor(status: ParentBookingGroupStatus): string {
  if (status === 'cancelled' || status === 'declined') return 'bg-danger-400'
  if (status === 'completed' || status === 'fully_paid' || status === 'at_camp')
    return 'bg-success-500'
  if (status === 'request' || status === 'expired') return 'bg-warning-500'
  return 'bg-primary-500'
}

function ageFromDateOfBirth(iso: string | null): number | null {
  if (!iso) return null
  const birthDate = new Date(iso)
  if (Number.isNaN(birthDate.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function formatSessionRange(startIso: string, endIso: string, sessionName: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sessionName
  const a = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const b = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${a} – ${b} · ${sessionName}`
}

function filterByTab(
  items: ParentBookingGroupSummary[],
  tab: BookingsTab
): ParentBookingGroupSummary[] {
  if (tab === 'past') return items.filter(i => i.status === 'completed')
  if (tab === 'cancelled') return items.filter(i => i.status === 'cancelled')
  if (tab === 'quotes') return []
  return items.filter(i => UPCOMING_STATUSES.includes(i.status))
}

function BookingCard({ row }: { row: ParentBookingGroupSummary }) {
  const cover = row.camp.coverImageUrl
  const pct = progressPercent(row.status)
  const barColor = progressBarColor(row.status)
  const isDraft = row.status === 'draft'
  const draftContinueHref = isDraft
    ? `/camps/${encodeURIComponent(row.camp.slug)}/book?bookingGroupId=${encodeURIComponent(row.id)}`
    : null

  const className =
    'flex flex-col overflow-hidden rounded-2xl border border-default-200 bg-white shadow-sm transition hover:border-default-300 hover:shadow-md sm:flex-row' +
    (isDraft ? ' cursor-pointer' : '')

  const inner = (
    <>
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-default-100 sm:h-auto sm:w-60 sm:min-h-[200px]">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        <span
          className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
        >
          {statusLabel(row.status)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-secondary">{row.camp.name}</h3>
        </div>
        <p className="text-sm text-default-600">
          {formatSessionRange(row.session.startDate, row.session.endDate, row.session.name)}
        </p>
        <div className="flex flex-wrap gap-2">
          {row.children.map(ch => {
            const age = ageFromDateOfBirth(ch.dateOfBirth)
            const initial = ch.firstName.charAt(0).toUpperCase()
            return (
              <div
                key={ch.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-3 py-1 text-sm text-default-800"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-rose-100 to-primary-100 text-[10px] font-semibold">
                  {initial}
                </span>
                {ch.firstName}
                {age !== null ? ` (${age})` : ''}
              </div>
            )
          })}
        </div>
        <div className="mt-auto space-y-2">
          <div className="flex justify-between text-xs text-default-500">
            <span>{statusLabel(row.status)}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-default-100">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </>
  )

  if (draftContinueHref) {
    return (
      <Link href={draftContinueHref} className={className}>
        {inner}
      </Link>
    )
  }

  return <div className={className}>{inner}</div>
}

export default function BookingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<ParentBookingGroupSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<BookingsTab>('upcoming')
  const [showSubmittedBanner, setShowSubmittedBanner] = useState(false)

  useEffect(() => {
    if (searchParams.get('submitted') === '1') {
      setShowSubmittedBanner(true)
      router.replace('/bookings', { scroll: false })
    }
  }, [searchParams, router])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await bookingGroupsService.list()
    if (res.success && res.data) {
      setItems(res.data)
    } else {
      setError((res.data as { message?: string })?.message ?? 'Could not load bookings.')
      setItems([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!items) return []
    return filterByTab(items, tab)
  }, [items, tab])

  const counts = useMemo(() => {
    if (!items) return { upcoming: 0, past: 0, cancelled: 0, quotes: 0 }
    return {
      upcoming: filterByTab(items, 'upcoming').length,
      past: filterByTab(items, 'past').length,
      cancelled: filterByTab(items, 'cancelled').length,
      quotes: 0,
    }
  }, [items])

  const subtitle = useMemo(() => {
    if (!items || items.length === 0) return 'View and manage your camp bookings'
    const upcoming = filterByTab(items, 'upcoming')
    const names = new Set<string>()
    upcoming.forEach(g => g.children.forEach(c => names.add(c.firstName)))
    const namePart = names.size
      ? ` for ${[...names].slice(0, 3).join(', ')}${names.size > 3 ? '…' : ''}`
      : ''
    return `${upcoming.length} upcoming booking${upcoming.length === 1 ? '' : 's'}${namePart}`
  }, [items])

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
        onSelectionChange={key => setTab(key as BookingsTab)}
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
              {counts.upcoming > 0 ? (
                <Chip size="sm" color="secondary">
                  {counts.upcoming}
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
              {counts.past > 0 ? (
                <Chip size="sm" color="secondary">
                  {counts.past}
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
              {counts.cancelled > 0 ? (
                <Chip size="sm" color="secondary">
                  {counts.cancelled}
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
      ) : tab === 'quotes' ? (
        <div className="rounded-2xl border border-dashed border-default-300 bg-default-50 px-6 py-16 text-center">
          <p className="text-lg font-medium text-secondary">No quotes or offers yet</p>
          <p className="mt-2 text-sm text-default-600">
            When camps send you personalized quotes, they will appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 px-6 py-16 text-center">
          <p className="text-lg font-medium text-secondary">
            {tab === 'upcoming'
              ? 'No upcoming bookings'
              : tab === 'past'
                ? 'No past bookings'
                : 'No cancelled bookings'}
          </p>
          <p className="mt-2 text-sm text-default-600">
            {tab === 'upcoming'
              ? 'Explore camps and start a booking request.'
              : 'Bookings you complete or cancel will show in these tabs.'}
          </p>
          {tab === 'upcoming' ? (
            <Button as={Link} href="/camps" color="primary" className="mt-6">
              Explore camps
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(row => (
            <BookingCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
