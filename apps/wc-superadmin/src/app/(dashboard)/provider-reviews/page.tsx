'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  Chip,
  type ChipProps,
  Pagination,
  Spinner,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
} from '@heroui/react'
import { Check, Eye } from 'lucide-react'
import { PageSlot } from '@/components/layout/page-slot'
import {
  type ListProviderReviewsResponse,
  type ProviderReviewRow,
  providerReviewsService,
  type ProviderReviewStatus,
  type ProviderSuspensionCategory,
} from '@/services/provider-reviews.services'

/**
 * Payments revamp (Spec v2.3 §4) — superadmin Provider Review queue.
 *
 * Provider cancellations and other risk signals open a review here; there is NO
 * auto-suspension anywhere. An admin picks a row up (`under_review`) and closes
 * it (`resolved`) with a decision. Actions hard-refetch the page so a concurrent
 * change can't leave the UI showing stale state.
 */

type TabType = 'pending' | 'under_review' | 'resolved' | 'all'

const PAGE_SIZE = 25

const STATUS_COLOR: Record<ProviderReviewStatus, ChipProps['color']> = {
  pending: 'warning',
  under_review: 'primary',
  resolved: 'success',
}

const STATUS_LABEL: Record<ProviderReviewStatus, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  resolved: 'Resolved',
}

const TYPE_LABEL: Record<ProviderSuspensionCategory, string> = {
  precautionary: 'Precautionary',
  safeguarding: 'Safeguarding',
  fraud: 'Fraud',
  insolvency: 'Insolvency',
  failed_capture_escalation: 'Failed capture',
}

export default function ProviderReviewsPage() {
  const [tab, setTab] = useState<TabType>('pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListProviderReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPendingId, setActionPendingId] = useState<string | null>(null)

  const tabToStatus: Record<TabType, ProviderReviewStatus | undefined> = {
    pending: 'pending',
    under_review: 'under_review',
    resolved: 'resolved',
    all: undefined,
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await providerReviewsService.list({
      status: tabToStatus[tab],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    if (!result.success) {
      setError((result.data as { message?: string })?.message ?? 'Failed to load provider reviews')
      setData(null)
    } else {
      setData(result.data)
    }
    setLoading(false)
  }, [tab, page])

  useEffect(() => {
    void load()
  }, [load])

  const handleStartReview = useCallback(
    async (row: ProviderReviewRow) => {
      setActionPendingId(row.id)
      try {
        const result = await providerReviewsService.resolve(row.id, { status: 'under_review' })
        if (!result.success) {
          setError((result.data as { message?: string })?.message ?? 'Failed to update review')
          return
        }
        await load()
      } finally {
        setActionPendingId(null)
      }
    },
    [load]
  )

  const handleResolve = useCallback(
    async (row: ProviderReviewRow) => {
      const decision = window.prompt(
        'Resolution decision (e.g. "cleared", "suspended"). Leave blank to cancel:'
      )
      if (!decision) return
      const decisionNotes = window.prompt('Optional notes:') ?? undefined
      setActionPendingId(row.id)
      try {
        const result = await providerReviewsService.resolve(row.id, {
          status: 'resolved',
          decision,
          decisionNotes,
        })
        if (!result.success) {
          setError((result.data as { message?: string })?.message ?? 'Failed to resolve review')
          return
        }
        await load()
      } finally {
        setActionPendingId(null)
      }
    },
    [load]
  )

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const rows = data?.rows ?? []

  const paginationFooter = data && data.total > 0 && (
    <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="text-sm text-default-500">
        Showing {rows.length} of {data.total} reviews
      </span>
      {totalPages > 1 ? (
        <Pagination total={totalPages} page={page} onChange={setPage} showControls />
      ) : null}
    </div>
  )

  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Provider Reviews</h1>
            <p className="mt-1 text-default-600">
              Provider cancellations and risk signals routed for human triage. No provider is ever
              auto-suspended — every action here is a deliberate admin decision.
            </p>
          </div>
        </header>

        {error ? (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-900/40 dark:bg-danger-950/30">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
            <Button className="mt-4" variant="flat" onPress={() => void load()}>
              Retry
            </Button>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="flex flex-wrap items-end gap-4 border-b border-default-200 px-4 py-3">
                <Tabs
                  selectedKey={tab}
                  onSelectionChange={key => {
                    setTab(key as TabType)
                    setPage(1)
                  }}
                  aria-label="Filter by status"
                >
                  <Tab key="pending" title="Pending" />
                  <Tab key="under_review" title="Under review" />
                  <Tab key="resolved" title="Resolved" />
                  <Tab key="all" title="All" />
                </Tabs>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table
                    aria-label="Provider reviews table"
                    classNames={{ wrapper: 'shadow-none' }}
                  >
                    <TableHeader>
                      <TableColumn>PROVIDER</TableColumn>
                      <TableColumn>TYPE</TableColumn>
                      <TableColumn>REASON</TableColumn>
                      <TableColumn>AFFECTED</TableColumn>
                      <TableColumn>STATUS</TableColumn>
                      <TableColumn>FLAGGED</TableColumn>
                      <TableColumn align="end">ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No provider reviews found.">
                      {rows.map(row => (
                        <ProviderReviewRowView
                          key={row.id}
                          row={row}
                          pending={actionPendingId === row.id}
                          onStartReview={() => handleStartReview(row)}
                          onResolve={() => handleResolve(row)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {paginationFooter}
            </CardBody>
          </Card>
        )}
      </section>
    </PageSlot>
  )
}

function ProviderReviewRowView({
  row,
  pending,
  onStartReview,
  onResolve,
}: {
  row: ProviderReviewRow
  pending: boolean
  onStartReview: () => void
  onResolve: () => void
}) {
  const flaggedDate = new Date(row.createdAt)
  const isResolved = row.status === 'resolved'

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{row.provider?.legalCompanyName ?? row.providerId}</span>
          <span className="text-xs text-default-500">{row.provider?.email ?? '—'}</span>
        </div>
      </TableCell>
      <TableCell>{TYPE_LABEL[row.suspensionType]}</TableCell>
      <TableCell className="max-w-xs">
        <span className="line-clamp-2 text-sm">{row.reasonText}</span>
      </TableCell>
      <TableCell>{row.affectedBookingCount} booking(s)</TableCell>
      <TableCell>
        <Chip color={STATUS_COLOR[row.status]} variant="flat" size="sm">
          {STATUS_LABEL[row.status]}
        </Chip>
      </TableCell>
      <TableCell>{flaggedDate.toLocaleDateString('en-US')}</TableCell>
      <TableCell>
        {isResolved ? (
          <span className="text-xs text-default-400">{row.decision ?? '—'}</span>
        ) : (
          <div className="flex justify-end gap-2">
            {row.status === 'pending' ? (
              <Button
                size="sm"
                variant="flat"
                isLoading={pending}
                startContent={pending ? null : <Eye className="h-4 w-4" />}
                onPress={onStartReview}
              >
                Start review
              </Button>
            ) : null}
            <Button
              size="sm"
              color="success"
              variant="flat"
              isLoading={pending}
              startContent={pending ? null : <Check className="h-4 w-4" />}
              onPress={onResolve}
            >
              Resolve
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}
