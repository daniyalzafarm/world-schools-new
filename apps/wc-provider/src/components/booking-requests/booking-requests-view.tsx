'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addToast,
  Button,
  Card,
  CardBody,
  Chip,
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
import { FilterX } from 'lucide-react'
import { formatCurrency } from '@world-schools/wc-utils'
import {
  formatSessionRange,
  providerRequestUrgencyLabel,
  providerStatusLabel,
  statusBadgeClass,
} from '@world-schools/wc-frontend-utils'
import {
  type BookingGroupStatus,
  PROVIDER_TAB_STATUS_FILTER,
  type ProviderBookingGroupDetail,
  type ProviderBookingSortField,
  type ProviderBookingTab,
} from '@world-schools/wc-types'
import { Input, SelectField, useDebounce } from '@world-schools/ui-web'
import { providerBookingGroupsService } from '@/services/provider-booking-groups.services'
import { useProviderBookingGroupsStore } from '@/stores/provider-booking-groups-store'
import { BookingRequestDrawer } from '@/components/booking-requests/booking-request-drawer'

function errMsg(data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data) {
    return String((data as { message?: string }).message ?? 'Request failed')
  }
  return 'Request failed'
}

export function BookingRequestsView() {
  const rows = useProviderBookingGroupsStore(s => s.rows)
  const loading = useProviderBookingGroupsStore(s => s.isLoading)
  const listError = useProviderBookingGroupsStore(s => s.error)
  const pagination = useProviderBookingGroupsStore(s => s.pagination)
  const filters = useProviderBookingGroupsStore(s => s.filters)
  const tabCounts = useProviderBookingGroupsStore(s => s.tabCounts)
  const fetchList = useProviderBookingGroupsStore(s => s.fetchList)
  const setFilters = useProviderBookingGroupsStore(s => s.setFilters)
  const setPage = useProviderBookingGroupsStore(s => s.setPage)
  const clearFilters = useProviderBookingGroupsStore(s => s.clearFilters)
  const clearError = useProviderBookingGroupsStore(s => s.clearError)

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 500)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const drawerOpen = selectedId != null

  const [detail, setDetail] = useState<ProviderBookingGroupDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
    void fetchList()
  }, [debouncedSearch, setFilters, fetchList])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetailError(null)
    const res = await providerBookingGroupsService.getById(id)
    setDetailLoading(false)
    if (!res.success || !res.data) {
      setDetail(null)
      setDetailError(errMsg(res.data))
      return
    }
    setDetail(res.data)
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setDetailError(null)
      return
    }
    setDetail(null)
    setDetailError(null)
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const onRespondRefresh = useCallback(async () => {
    await fetchList()
    if (selectedId) await loadDetail(selectedId)
  }, [fetchList, loadDetail, selectedId])

  const runAccept = useCallback(
    async (note: string) => {
      if (!selectedId) return { ok: false as const, message: 'No booking selected' }
      setActionLoading(true)
      const res = await providerBookingGroupsService.accept(selectedId, {
        providerNote: note || undefined,
      })
      setActionLoading(false)
      if (!res.success) {
        const m = errMsg(res.data)
        addToast({ title: 'Could not accept', description: m, color: 'danger' })
        return { ok: false as const, message: m }
      }
      addToast({ title: 'Booking accepted', color: 'success' })
      await onRespondRefresh()
      return { ok: true as const }
    },
    [selectedId, onRespondRefresh]
  )

  const runDecline = useCallback(
    async (note: string) => {
      if (!selectedId) return { ok: false as const, message: 'No booking selected' }
      setActionLoading(true)
      const res = await providerBookingGroupsService.decline(selectedId, {
        providerNote: note || undefined,
      })
      setActionLoading(false)
      if (!res.success) {
        const m = errMsg(res.data)
        addToast({ title: 'Could not decline', description: m, color: 'danger' })
        return { ok: false as const, message: m }
      }
      addToast({ title: 'Booking declined', color: 'success' })
      await onRespondRefresh()
      return { ok: true as const }
    },
    [selectedId, onRespondRefresh]
  )

  const handleTabChange = (key: React.Key) => {
    setFilters({ tab: key as ProviderBookingTab, status: undefined })
    void fetchList()
  }

  const handleColumnSort = (column: ProviderBookingSortField) => {
    const isSame = filters.sortBy === column
    const nextOrder: 'asc' | 'desc' = isSame && filters.sortOrder === 'asc' ? 'desc' : 'asc'
    setFilters({ sortBy: column, sortOrder: nextOrder })
    void fetchList()
  }

  const statusFilterOptions = useMemo(() => {
    const statuses = PROVIDER_TAB_STATUS_FILTER[filters.tab]
    return [
      { value: 'all', label: 'All statuses' },
      ...statuses.map(s => ({
        value: s,
        label: providerStatusLabel(s),
      })),
    ]
  }, [filters.tab])

  const handleStatusFilterChange = (value: string) => {
    if (value === 'all') setFilters({ status: undefined })
    else setFilters({ status: value as BookingGroupStatus })
    void fetchList()
  }

  const handlePageChange = (page: number) => {
    setPage(page)
    void fetchList()
  }

  const handleClearFilters = () => {
    setSearchInput('')
    clearFilters()
    void fetchList()
  }

  const statusFilterValue = filters.status ?? 'all'

  const hasActiveFilters = useMemo(
    () =>
      Boolean(searchInput.trim()) ||
      filters.status != null ||
      filters.sortBy !== 'updatedAt' ||
      filters.sortOrder !== 'desc',
    [searchInput, filters.status, filters.sortBy, filters.sortOrder]
  )

  const counts = tabCounts

  const paginationFooter = pagination.total > 0 && (
    <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="text-sm text-default-500">
        Showing {rows.length} of {pagination.total} bookings
      </span>
      {pagination.totalPages > 1 ? (
        <Pagination
          total={pagination.totalPages}
          page={pagination.page}
          onChange={handlePageChange}
          showControls
        />
      ) : null}
    </div>
  )

  return (
    <>
      {listError ? (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-900/40 dark:bg-danger-950/30">
          <p className="text-danger-800 dark:text-danger-200">{listError}</p>
          <Button
            className="mt-4"
            variant="flat"
            onPress={() => {
              clearError()
              void fetchList()
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="flex gap-2 border-b border-default-200 px-4 pt-3">
              <Tabs
                aria-label="Booking request categories"
                selectedKey={filters.tab}
                onSelectionChange={handleTabChange}
                variant="underlined"
                classNames={{
                  base: 'w-full',
                  tab: 'w-36 px-0!',
                  tabList: 'p-0!',
                }}
              >
                <Tab
                  key="requests"
                  title={
                    <span className="flex items-center gap-1.5">
                      <span>Requests</span>
                      {counts.requests > 0 ? (
                        <Chip size="sm" color="secondary">
                          {counts.requests}
                        </Chip>
                      ) : null}
                    </span>
                  }
                />
                <Tab
                  key="upcoming"
                  title={
                    <span className="flex items-center gap-1.5">
                      <span>Upcoming</span>
                      {counts.upcoming > 0 ? (
                        <Chip size="sm" color="secondary">
                          {counts.upcoming}
                        </Chip>
                      ) : null}
                    </span>
                  }
                />
                <Tab
                  key="at-camp"
                  title={
                    <span className="flex items-center gap-1.5">
                      <span>At camp</span>
                      {counts.atCamp > 0 ? (
                        <Chip size="sm" color="secondary">
                          {counts.atCamp}
                        </Chip>
                      ) : null}
                    </span>
                  }
                />
                <Tab
                  key="past"
                  title={
                    <span className="flex items-center gap-1.5">
                      <span>Past</span>
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
                      <span>Cancelled</span>
                      {counts.cancelled > 0 ? (
                        <Chip size="sm" color="secondary">
                          {counts.cancelled}
                        </Chip>
                      ) : null}
                    </span>
                  }
                />
              </Tabs>
            </div>

            <div className="flex flex-wrap items-end gap-4 border-b border-default-200 px-4 py-3">
              <Input
                aria-label="Search bookings"
                placeholder="Search reference, parent, camp, session…"
                className="w-full max-w-sm shrink-0"
                value={searchInput}
                onValueChange={setSearchInput}
                isClearable
                onClear={() => setSearchInput('')}
              />
              <SelectField
                aria-label="Booking status"
                fullWidth={false}
                value={statusFilterValue}
                onChange={handleStatusFilterChange}
                options={statusFilterOptions}
                placeholder="Status"
              />
              {hasActiveFilters ? (
                <Button
                  variant="flat"
                  className="ml-auto shrink-0"
                  startContent={<FilterX className="h-4 w-4" />}
                  onPress={handleClearFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table
                aria-label="Booking requests table"
                classNames={{
                  wrapper: 'shadow-none',
                }}
              >
                <TableHeader>
                  <TableColumn
                    className="min-w-[140px] cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-default-500"
                    onClick={() => handleColumnSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {filters.sortBy === 'status' ? (
                        <span className="text-[10px]">
                          {filters.sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      ) : null}
                    </div>
                  </TableColumn>
                  <TableColumn
                    className="min-w-[160px] cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-default-500"
                    onClick={() => handleColumnSort('bookingGroupNumber')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Reference</span>
                      {filters.sortBy === 'bookingGroupNumber' ? (
                        <span className="text-[10px]">
                          {filters.sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      ) : null}
                    </div>
                  </TableColumn>
                  <TableColumn
                    className="min-w-[200px] cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-default-500"
                    onClick={() => handleColumnSort('parentFirstName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Booked by</span>
                      {filters.sortBy === 'parentFirstName' ? (
                        <span className="text-[10px]">
                          {filters.sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      ) : null}
                    </div>
                  </TableColumn>
                  <TableColumn
                    className="min-w-[220px] cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-default-500"
                    onClick={() => handleColumnSort('sessionName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Session</span>
                      {filters.sortBy === 'sessionName' ? (
                        <span className="text-[10px]">
                          {filters.sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      ) : null}
                    </div>
                  </TableColumn>
                  <TableColumn
                    className="min-w-[120px] cursor-pointer select-none text-right text-xs font-semibold uppercase tracking-wide text-default-500"
                    onClick={() => handleColumnSort('totalAmount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Amount</span>
                      {filters.sortBy === 'totalAmount' ? (
                        <span className="text-[10px]">
                          {filters.sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      ) : null}
                    </div>
                  </TableColumn>
                </TableHeader>
                <TableBody
                  items={rows}
                  isLoading={loading}
                  emptyContent={
                    <div className="py-12 text-center">
                      <p className="text-default-500">No bookings in this tab.</p>
                    </div>
                  }
                >
                  {row => {
                    const urgency =
                      row.status === 'request' ? providerRequestUrgencyLabel(row.expiresAt) : null
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(row.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedId(row.id)
                          }
                        }}
                        tabIndex={0}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                            >
                              {providerStatusLabel(row.status)}
                            </span>
                            {urgency ? (
                              <span className="text-xs text-warning-700 dark:text-warning-400">
                                {urgency}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-default-600">
                            {row.bookingGroupNumber}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground">{row.parent.displayName}</p>
                          <p className="text-xs text-default-500">
                            {row.children.length} {row.children.length === 1 ? 'child' : 'children'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-default-700">{row.session.name}</p>
                          <p className="text-xs text-default-500">
                            {formatSessionRange(
                              row.session.startDate,
                              row.session.endDate,
                              row.session.name
                            )}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-foreground">
                            {formatCurrency(row.totalAmount, row.currency)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  }}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" label="Loading booking requests" />
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-default-300 py-16 text-center text-default-500">
                  No bookings in this tab.
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {rows.map(row => {
                    const urgency =
                      row.status === 'request' ? providerRequestUrgencyLabel(row.expiresAt) : null
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className="w-full rounded-xl border border-default-200 bg-content1 p-4 text-left shadow-sm transition hover:border-primary-300 dark:border-default-100/20"
                        onClick={() => setSelectedId(row.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-default-500">
                              {row.bookingGroupNumber}
                            </p>
                            <p className="font-semibold text-default-900 dark:text-default-100">
                              {row.parent.displayName}
                            </p>
                            <p className="text-xs text-default-500">{row.camp.name}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                          >
                            {providerStatusLabel(row.status)}
                          </span>
                        </div>
                        {urgency ? (
                          <p className="mt-1 text-xs text-warning-700">{urgency}</p>
                        ) : null}
                        <p className="mt-2 text-sm text-default-600">{row.session.name}</p>
                        <p className="mt-2 text-lg font-bold text-default-900 dark:text-default-100">
                          {formatCurrency(row.totalAmount, row.currency)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {paginationFooter}
          </CardBody>
        </Card>
      )}

      <BookingRequestDrawer
        isOpen={drawerOpen}
        onOpenChange={open => {
          if (!open) setSelectedId(null)
        }}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => selectedId && void loadDetail(selectedId)}
        onDetailRefresh={() => selectedId && void loadDetail(selectedId)}
        actionLoading={actionLoading}
        onAccept={runAccept}
        onDecline={runDecline}
      />
    </>
  )
}
