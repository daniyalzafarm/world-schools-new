'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Pagination,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { Check, XCircle } from 'lucide-react'
import { PageSlot } from '@/components/layout/page-slot'
import {
  type ListPaymentReviewsResponse,
  type PaymentReviewRow,
  paymentReviewsService,
} from '@/services/payment-reviews.services'

/**
 * Payments revamp (Spec v2.3 §7) — superadmin Payment Review queue.
 *
 * Bookings whose scheduled capture exhausted its retries land here — never
 * auto-cancelled. An admin either cancels+refunds the booking or marks it
 * resolved (collected offline). Actions hard-refetch so concurrent changes
 * can't leave the UI stale.
 */

const PAGE_SIZE = 25

export default function PaymentReviewsPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListPaymentReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPendingId, setActionPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await paymentReviewsService.list({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    if (!result.success) {
      setError((result.data as { message?: string })?.message ?? 'Failed to load payment reviews')
      setData(null)
    } else {
      setData(result.data)
    }
    setLoading(false)
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = useCallback(
    async (row: PaymentReviewRow, action: 'cancel' | 'mark_resolved') => {
      const confirmMsg =
        action === 'cancel'
          ? `Cancel booking ${row.bookingGroupNumber} and refund everything captured? This cannot be undone.`
          : `Mark booking ${row.bookingGroupNumber} resolved (handled offline)? No refund or charge will be made.`
      if (!window.confirm(confirmMsg)) return
      const notes = window.prompt('Optional notes:') ?? undefined
      setActionPendingId(row.id)
      try {
        const result = await paymentReviewsService.resolve(row.id, { action, notes })
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

  return (
    <PageSlot>
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Payment Reviews</h1>
          <p className="mt-1 text-default-600">
            Bookings whose scheduled capture failed past its retry window. Nothing is auto-cancelled
            — triage each: cancel + refund, or mark resolved if collected offline.
          </p>
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
              {loading ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table aria-label="Payment reviews table" classNames={{ wrapper: 'shadow-none' }}>
                    <TableHeader>
                      <TableColumn>BOOKING</TableColumn>
                      <TableColumn>CAMP / PROVIDER</TableColumn>
                      <TableColumn>PARENT</TableColumn>
                      <TableColumn>PAID / TOTAL</TableColumn>
                      <TableColumn>FLAGGED</TableColumn>
                      <TableColumn align="end">ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No payment reviews — all clear.">
                      {rows.map(row => (
                        <PaymentReviewRowView
                          key={row.id}
                          row={row}
                          pending={actionPendingId === row.id}
                          onCancel={() => resolve(row, 'cancel')}
                          onMarkResolved={() => resolve(row, 'mark_resolved')}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {data && data.total > 0 ? (
                <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span className="text-sm text-default-500">
                    Showing {rows.length} of {data.total} reviews
                  </span>
                  {totalPages > 1 ? (
                    <Pagination total={totalPages} page={page} onChange={setPage} showControls />
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>
        )}
      </section>
    </PageSlot>
  )
}

function PaymentReviewRowView({
  row,
  pending,
  onCancel,
  onMarkResolved,
}: {
  row: PaymentReviewRow
  pending: boolean
  onCancel: () => void
  onMarkResolved: () => void
}) {
  const currency = (row.provider?.settings?.currency ?? '').toUpperCase()
  const parentName =
    [row.parent?.user?.firstName, row.parent?.user?.lastName].filter(Boolean).join(' ') ||
    row.parent?.user?.email ||
    '—'
  const flagged = row.paymentReviewFlaggedAt ? new Date(row.paymentReviewFlaggedAt) : null

  return (
    <TableRow>
      <TableCell className="font-medium">{row.bookingGroupNumber}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{row.camp?.name ?? '—'}</span>
          <span className="text-xs text-default-500">{row.provider?.legalCompanyName ?? '—'}</span>
        </div>
      </TableCell>
      <TableCell>{parentName}</TableCell>
      <TableCell className="font-mono">
        {row.paidAmount} / {row.totalAmount} {currency}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{flagged ? flagged.toLocaleDateString('en-US') : '—'}</span>
          <Chip color="warning" variant="flat" size="sm">
            {row.paymentReviewStatus ?? 'in review'}
          </Chip>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            color="danger"
            variant="flat"
            isLoading={pending}
            startContent={pending ? null : <XCircle className="h-4 w-4" />}
            onPress={onCancel}
          >
            Cancel + refund
          </Button>
          <Button
            size="sm"
            color="success"
            variant="flat"
            isLoading={pending}
            startContent={pending ? null : <Check className="h-4 w-4" />}
            onPress={onMarkResolved}
          >
            Mark resolved
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
