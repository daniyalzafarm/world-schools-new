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
import { Check, Slash } from 'lucide-react'
import { PageSlot } from '@/components/layout/page-slot'
import { Can } from '@/components/auth/can'
import {
  type ListReimbursementsResponse,
  type ReimbursementRow,
  reimbursementsService,
  type ReimbursementStatus,
} from '@/services/reimbursements.services'

/**
 * Phase 4 — superadmin Reimbursements list page.
 *
 * The list is sorted server-side by `dueDate ASC` so the most-urgent
 * (oldest pending) row sits at the top. The "All" tab shows everything;
 * the "Pending" tab is the working queue. Settled/written-off rows are
 * read-only (action buttons hidden).
 *
 * Action buttons fire the matching POST endpoint then re-fetch the page —
 * this is intentionally a hard refetch rather than an optimistic update so
 * a webhook-driven status change concurrent with the click can't end up
 * with the UI showing stale state.
 */

type TabType = 'all' | 'pending' | 'settled' | 'written_off'

const PAGE_SIZE = 25

const STATUS_COLOR: Record<ReimbursementStatus, ChipProps['color']> = {
  not_required: 'default',
  pending: 'warning',
  invoiced: 'primary',
  settled: 'success',
  written_off: 'default',
}

const STATUS_LABEL: Record<ReimbursementStatus, string> = {
  not_required: 'Not required',
  pending: 'Pending',
  invoiced: 'Invoiced',
  settled: 'Settled',
  written_off: 'Written off',
}

export default function ReimbursementsPage() {
  const [tab, setTab] = useState<TabType>('pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListReimbursementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPendingId, setActionPendingId] = useState<string | null>(null)

  const tabToStatus: Record<TabType, ReimbursementStatus | undefined> = {
    all: undefined,
    pending: 'pending',
    settled: 'settled',
    written_off: 'written_off',
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await reimbursementsService.list({
      status: tabToStatus[tab],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    if (!result.success) {
      setError((result.data as { message?: string })?.message ?? 'Failed to load reimbursements')
      setData(null)
    } else {
      setData(result.data)
    }
    setLoading(false)
  }, [tab, page])

  useEffect(() => {
    void load()
  }, [load])

  const handleSettle = useCallback(
    async (row: ReimbursementRow) => {
      setActionPendingId(row.id)
      try {
        const result = await reimbursementsService.settle(row.id)
        if (!result.success) {
          setError((result.data as { message?: string })?.message ?? 'Failed to settle')
          return
        }
        await load()
      } finally {
        setActionPendingId(null)
      }
    },
    [load]
  )

  const handleWriteOff = useCallback(
    async (row: ReimbursementRow) => {
      if (
        !window.confirm(
          `Write off this reimbursement? This is a final state — no further reminders will be sent.`
        )
      ) {
        return
      }
      setActionPendingId(row.id)
      try {
        const result = await reimbursementsService.writeOff(row.id)
        if (!result.success) {
          setError((result.data as { message?: string })?.message ?? 'Failed to write off')
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
        Showing {rows.length} of {data.total} reimbursements
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reimbursements</h1>
            <p className="mt-1 text-default-600">
              Refunds issued after the camp&apos;s payout was disbursed. The camp owes the platform
              until settled.
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
                  <Tab key="all" title="All" />
                  <Tab key="settled" title="Settled" />
                  <Tab key="written_off" title="Written off" />
                </Tabs>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table aria-label="Reimbursements table" classNames={{ wrapper: 'shadow-none' }}>
                    <TableHeader>
                      <TableColumn>BOOKING</TableColumn>
                      <TableColumn>CAMP / PROVIDER</TableColumn>
                      <TableColumn>PARENT</TableColumn>
                      <TableColumn>AMOUNT OWED</TableColumn>
                      <TableColumn>DUE</TableColumn>
                      <TableColumn>STATUS</TableColumn>
                      <TableColumn align="end">ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No reimbursements found.">
                      {rows.map(row => (
                        <ReimbursementRowView
                          key={row.id}
                          row={row}
                          pending={actionPendingId === row.id}
                          onSettle={() => handleSettle(row)}
                          onWriteOff={() => handleWriteOff(row)}
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

function ReimbursementRowView({
  row,
  pending,
  onSettle,
  onWriteOff,
}: {
  row: ReimbursementRow
  pending: boolean
  onSettle: () => void
  onWriteOff: () => void
}) {
  const dueDate = new Date(row.dueDate)
  const overdueDays = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (24 * 3600 * 1000)))
  const isPending = row.status === 'pending'
  const parentName =
    [row.bookingGroup?.parent?.user?.firstName, row.bookingGroup?.parent?.user?.lastName]
      .filter(Boolean)
      .join(' ') ||
    row.bookingGroup?.parent?.user?.email ||
    '—'

  return (
    <TableRow>
      <TableCell className="font-medium">
        {row.bookingGroup?.bookingGroupNumber ?? row.bookingGroupId}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{row.bookingGroup?.camp?.name ?? '—'}</span>
          <span className="text-xs text-default-500">
            {row.bookingGroup?.provider?.legalCompanyName ?? '—'}
          </span>
        </div>
      </TableCell>
      <TableCell>{parentName}</TableCell>
      <TableCell className="font-mono">
        {row.amountOwed} {row.currency.toUpperCase()}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{dueDate.toLocaleDateString('en-US')}</span>
          {isPending && overdueDays > 0 ? (
            <span className="text-xs text-danger">{overdueDays}d overdue</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Chip color={STATUS_COLOR[row.status]} variant="flat" size="sm">
          {STATUS_LABEL[row.status]}
        </Chip>
      </TableCell>
      <TableCell>
        {isPending ? (
          <Can
            permission="billing.write"
            fallback={<span className="text-xs text-default-400">—</span>}
          >
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                color="success"
                variant="flat"
                isLoading={pending}
                startContent={pending ? null : <Check className="h-4 w-4" />}
                onPress={onSettle}
              >
                Settle
              </Button>
              <Button
                size="sm"
                variant="flat"
                isLoading={pending}
                startContent={pending ? null : <Slash className="h-4 w-4" />}
                onPress={onWriteOff}
              >
                Write off
              </Button>
            </div>
          </Can>
        ) : (
          <span className="text-xs text-default-400">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}
