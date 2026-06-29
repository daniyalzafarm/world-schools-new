'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { ArrowRight } from 'lucide-react'
import { PageSlot } from '@/components/layout/page-slot'
import {
  type DisputeOutcome,
  type DisputeRow,
  disputesService,
  type ListDisputesResponse,
} from '@/services/disputes.services'

/**
 * Superadmin Disputes queue.
 *
 * Sorted server-side by `evidenceDueBy ASC NULLS LAST` so disputes nearest
 * their Stripe evidence deadline sit at the top. The "Open" tab is the
 * working queue; closed disputes (won/lost/warning_closed/other) are
 * archive-only — actions are hidden once a dispute leaves `open`.
 *
 * Action buttons live on the detail page (`/disputes/[id]`) — this list
 * shows status + key dates and routes through.
 */

type TabType = 'open' | 'won' | 'lost' | 'warning_closed' | 'all'

const PAGE_SIZE = 25

const OUTCOME_COLOR: Record<DisputeOutcome, ChipProps['color']> = {
  open: 'warning',
  won: 'success',
  lost: 'danger',
  warning_closed: 'default',
  other: 'default',
}

const OUTCOME_LABEL: Record<DisputeOutcome, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  warning_closed: 'Warning closed',
  other: 'Other',
}

export default function DisputesPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabType>('open')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListDisputesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tabToOutcome: Record<TabType, DisputeOutcome | undefined> = {
    open: 'open',
    won: 'won',
    lost: 'lost',
    warning_closed: 'warning_closed',
    all: undefined,
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await disputesService.list({
      outcome: tabToOutcome[tab],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    if (!result.success) {
      setError((result.data as { message?: string })?.message ?? 'Failed to load disputes')
      setData(null)
    } else {
      setData(result.data)
    }
    setLoading(false)
  }, [tab, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const rows = data?.rows ?? []

  const paginationFooter = data && data.total > 0 && (
    <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="text-sm text-default-500">
        Showing {rows.length} of {data.total} disputes
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Disputes</h1>
            <p className="mt-1 text-default-600">
              Stripe chargebacks against booked sessions. Submit evidence before the deadline or
              forfeit the disputed amount.
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
                  aria-label="Filter by outcome"
                >
                  <Tab key="open" title="Open" />
                  <Tab key="all" title="All" />
                  <Tab key="won" title="Won" />
                  <Tab key="lost" title="Lost" />
                  <Tab key="warning_closed" title="Warning closed" />
                </Tabs>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table aria-label="Disputes table" classNames={{ wrapper: 'shadow-none' }}>
                    <TableHeader>
                      <TableColumn>BOOKING</TableColumn>
                      <TableColumn>CAMP / PROVIDER</TableColumn>
                      <TableColumn>PARENT</TableColumn>
                      <TableColumn>AMOUNT</TableColumn>
                      <TableColumn>REASON</TableColumn>
                      <TableColumn>EVIDENCE DUE</TableColumn>
                      <TableColumn>OUTCOME</TableColumn>
                      <TableColumn align="end">ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No disputes found.">
                      {rows.map(row => (
                        <DisputeRowView
                          key={row.id}
                          row={row}
                          onOpen={() => router.push(`/disputes/${row.id}`)}
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

function DisputeRowView({ row, onOpen }: { row: DisputeRow; onOpen: () => void }) {
  const isOpen = row.outcome === 'open'
  const dueDate = row.evidenceDueBy ? new Date(row.evidenceDueBy) : null
  const hoursUntilDue = dueDate
    ? Math.floor((dueDate.getTime() - Date.now()) / (60 * 60 * 1000))
    : null
  const isUrgent = isOpen && hoursUntilDue != null && hoursUntilDue <= 72 && hoursUntilDue >= 0
  const isPastDue = isOpen && hoursUntilDue != null && hoursUntilDue < 0

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
        {row.amount} {row.currency.toUpperCase()}
      </TableCell>
      <TableCell>
        <span className="text-xs text-default-600 capitalize">{row.reason.replace(/_/g, ' ')}</span>
      </TableCell>
      <TableCell>
        {dueDate ? (
          <div className="flex flex-col">
            <span>{dueDate.toLocaleDateString('en-US')}</span>
            {isPastDue ? (
              <span className="text-xs text-danger">Past due</span>
            ) : isUrgent ? (
              <span className="text-xs text-warning">{hoursUntilDue}h left</span>
            ) : null}
          </div>
        ) : (
          <span className="text-default-400">—</span>
        )}
      </TableCell>
      <TableCell>
        <Chip color={OUTCOME_COLOR[row.outcome]} variant="flat" size="sm">
          {OUTCOME_LABEL[row.outcome]}
        </Chip>
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="flat"
            color={isOpen ? 'primary' : 'default'}
            endContent={<ArrowRight className="h-4 w-4" />}
            onPress={onOpen}
          >
            {isOpen ? 'Manage' : 'View'}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
