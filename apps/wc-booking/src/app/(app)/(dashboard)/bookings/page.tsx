'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addToast, Alert, Button, Chip, Pagination, Spinner, Tab, Tabs } from '@heroui/react'
import { useConfirmDialog } from '@world-schools/ui-web'
import {
  PARENT_BOOKING_TABS,
  type ParentBookingGroupsListMeta,
  type ParentBookingTab,
} from '@world-schools/wc-types'
import { bookingGroupsService } from '@/services/booking-groups.services'
import {
  ageFromDateOfBirth,
  formatSessionRange,
  statusBadgeClass,
  statusLabel,
} from '@world-schools/wc-frontend-utils'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'

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

function BookingCard({
  row,
  onDraftDeleted,
}: {
  row: ParentBookingGroupSummary
  onDraftDeleted: () => void | Promise<void>
}) {
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [deleting, setDeleting] = useState(false)
  const cover = row.camp.coverImageUrl
  const isDraft = row.status === 'draft'
  const draftContinueHref = isDraft
    ? `/book/${encodeURIComponent(row.camp.slug)}?bookingGroupId=${encodeURIComponent(row.id)}`
    : null
  const detailHref = !isDraft ? `/bookings/${encodeURIComponent(row.id)}` : null

  const className =
    'flex flex-col overflow-hidden rounded-2xl border border-default-200 bg-white shadow-sm transition hover:border-default-300 hover:shadow-md sm:flex-row' +
    (isDraft || detailHref ? ' cursor-pointer' : '') +
    (row.status === 'completed' ? ' opacity-[0.85]' : '')

  const handleDeleteDraft = async () => {
    const ok = await confirm({
      title: 'Delete draft booking?',
      message:
        'This will remove your saved progress for this camp. You can start a new booking anytime.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    setDeleting(true)
    try {
      const res = await bookingGroupsService.deleteDraft(row.id)
      if (res.success) {
        addToast({ title: 'Draft deleted', color: 'success' })
        await onDraftDeleted()
      } else {
        const msg =
          typeof res.data === 'object' && res.data && 'message' in res.data
            ? String((res.data as { message?: string }).message)
            : 'Could not delete this draft.'
        addToast({ title: 'Could not delete', description: msg, color: 'danger' })
      }
    } finally {
      setDeleting(false)
    }
  }

  const inner = (
    <>
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-default-100 sm:h-auto sm:w-60 sm:min-h-36">
        {cover ? (
          <img
            src={cover}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover${row.status === 'cancelled' ? ' grayscale' : ''}`}
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
          <div>
            <p className="mb-0.5 font-mono text-xs text-default-500">{row.bookingGroupNumber}</p>
            <h3 className="text-lg font-semibold text-secondary">{row.camp.name}</h3>
          </div>
          {isDraft ? (
            <div
              className="shrink-0"
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
              role="presentation"
            >
              <Button
                size="sm"
                variant="flat"
                color="danger"
                isLoading={deleting}
                isDisabled={deleting}
                onPress={handleDeleteDraft}
                isIconOnly
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
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
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-rose-100 to-primary-100 text-xs font-semibold">
                  {initial}
                </span>
                {ch.firstName}
                {age !== null ? ` (${age})` : ''}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )

  if (draftContinueHref) {
    return (
      <div
        role="link"
        tabIndex={0}
        className={className}
        onClick={() => {
          if (deleting) return
          router.push(draftContinueHref)
        }}
        onKeyDown={e => {
          if (deleting) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            router.push(draftContinueHref)
          }
        }}
      >
        {inner}
      </div>
    )
  }

  if (detailHref) {
    return (
      <Link href={detailHref} className={className}>
        {inner}
      </Link>
    )
  }

  return <div className={className}>{inner}</div>
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
