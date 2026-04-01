'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { addToast, Button, Chip, Spinner, Tab, Tabs } from '@heroui/react'
import { formatCurrency } from '@world-schools/wc-utils'
import {
  formatSessionRange,
  providerRequestUrgencyLabel,
  providerStatusLabel,
  statusBadgeClass,
} from '@world-schools/wc-frontend-utils'
import type {
  BookingGroupStatus,
  ProviderBookingGroupDetail,
  ProviderBookingGroupSummary,
} from '@world-schools/wc-types'
import { providerBookingGroupsService } from '@/services/provider-booking-groups.services'
import { BookingRequestDrawer } from '@/components/booking-requests/booking-request-drawer'

type TabId = 'requests' | 'upcoming' | 'at-camp' | 'past' | 'cancelled'

function tabStatuses(tab: TabId): BookingGroupStatus[] {
  switch (tab) {
    case 'requests':
      return ['request']
    case 'upcoming':
      return ['accepted', 'deposit_paid', 'fully_paid']
    case 'at-camp':
      return ['at_camp']
    case 'past':
      return ['completed', 'declined', 'expired']
    case 'cancelled':
      return ['cancelled']
    default:
      return []
  }
}

function filterByTab(
  rows: ProviderBookingGroupSummary[],
  tab: TabId
): ProviderBookingGroupSummary[] {
  const allowed = new Set(tabStatuses(tab))
  return rows.filter(r => allowed.has(r.status))
}

function errMsg(data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data) {
    return String((data as { message?: string }).message ?? 'Request failed')
  }
  return 'Request failed'
}

export function BookingRequestsView() {
  const [rows, setRows] = useState<ProviderBookingGroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('requests')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const drawerOpen = selectedId != null

  const [detail, setDetail] = useState<ProviderBookingGroupDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    setListError(null)
    const res = await providerBookingGroupsService.list()
    setLoading(false)
    if (!res.success || !res.data) {
      setRows([])
      setListError(errMsg(res.data))
      return
    }
    setRows(Array.isArray(res.data) ? res.data : [])
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

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

  const filtered = useMemo(() => filterByTab(rows, tab), [rows, tab])

  const counts = useMemo(() => {
    const c = {
      requests: 0,
      upcoming: 0,
      atCamp: 0,
      past: 0,
      cancelled: 0,
    }
    for (const r of rows) {
      if (r.status === 'request') c.requests++
      else if (r.status === 'accepted' || r.status === 'deposit_paid' || r.status === 'fully_paid')
        c.upcoming++
      else if (r.status === 'at_camp') c.atCamp++
      else if (r.status === 'completed' || r.status === 'declined' || r.status === 'expired')
        c.past++
      else if (r.status === 'cancelled') c.cancelled++
    }
    return c
  }, [rows])

  const onRespondRefresh = useCallback(async () => {
    await loadList()
    if (selectedId) await loadDetail(selectedId)
  }, [loadList, loadDetail, selectedId])

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

  return (
    <>
      <div className="mb-6">
        <Tabs
          aria-label="Booking request categories"
          selectedKey={tab}
          onSelectionChange={key => setTab(key as TabId)}
          variant="underlined"
          classNames={{
            base: 'w-full border-b border-divider',
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

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading booking requests" />
        </div>
      ) : listError ? (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-900/40 dark:bg-danger-950/30">
          <p className="text-danger-800 dark:text-danger-200">{listError}</p>
          <Button className="mt-4" variant="flat" onPress={() => void loadList()}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-default-300 py-16 text-center text-default-500">
          No bookings in this tab.
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-default-200 dark:border-default-100/20">
            <table className="min-w-full divide-y divide-default-200 text-left text-sm dark:divide-default-100/20">
              <thead className="bg-default-100/80 dark:bg-default-100/10">
                <tr>
                  <th className="px-4 py-3 font-semibold text-default-700">Status</th>
                  <th className="px-4 py-3 font-semibold text-default-700">Booked by</th>
                  <th className="px-4 py-3 font-semibold text-default-700">Session</th>
                  <th className="px-4 py-3 font-semibold text-default-700 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200 dark:divide-default-100/15">
                {filtered.map(row => {
                  const urgency =
                    row.status === 'request' ? providerRequestUrgencyLabel(row.expiresAt) : null
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-default-100/60 dark:hover:bg-default-100/10"
                      onClick={() => setSelectedId(row.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedId(row.id)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                    >
                      <td className="px-4 py-3 align-top">
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
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-default-900 dark:text-default-100">
                          {row.parent.displayName}
                        </p>
                        <p className="text-xs text-default-500">
                          {row.children.length} {row.children.length === 1 ? 'child' : 'children'}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-default-700">
                        <p className="font-medium">{row.session.name}</p>
                        <p className="text-xs text-default-500">
                          {formatSessionRange(
                            row.session.startDate,
                            row.session.endDate,
                            row.session.name
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-right font-semibold text-default-900 dark:text-default-100">
                        {formatCurrency(row.totalAmount, row.currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map(row => {
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
                  {urgency ? <p className="mt-1 text-xs text-warning-700">{urgency}</p> : null}
                  <p className="mt-2 text-sm text-default-600">{row.session.name}</p>
                  <p className="mt-2 text-lg font-bold text-default-900 dark:text-default-100">
                    {formatCurrency(row.totalAmount, row.currency)}
                  </p>
                </button>
              )
            })}
          </div>
        </>
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
        actionLoading={actionLoading}
        onAccept={runAccept}
        onDecline={runDecline}
      />
    </>
  )
}
