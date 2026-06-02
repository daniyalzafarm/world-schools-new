'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  addToast,
  Button,
  Card,
  CardBody,
  Chip,
  Pagination,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  Tooltip,
} from '@heroui/react'
import { Check, Eye, FilterX, LogIn, Search, Upload } from 'lucide-react'
import { getInitials, Input, useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import { OPERATIONAL_STATUS_LABELS, OperationalStatus } from '@world-schools/wc-types'
import { PageSlot } from '@/components/layout/page-slot'
import { useApplicationReviewStore } from '@/stores/application-review-store'
import { providersService } from '@/services/providers.services'
import config from '@/config/config'
import type {
  ApplicationListItem,
  ApprovalStatus,
  OperationalStatusReasons,
} from '@/types/application-review'

type AllProvidersTab = 'all' | 'pending-review' | 'approved' | 'rejected' | 'suspended'

const TAB_STATUS_MAP: Record<AllProvidersTab, ApprovalStatus | undefined> = {
  all: undefined,
  'pending-review': 'under_review',
  approved: 'approved',
  rejected: 'rejected',
  suspended: 'suspended',
}

const TAB_PATHS: Record<AllProvidersTab, string> = {
  all: '/providers',
  'pending-review': '/providers/pending-review',
  approved: '/providers/approved',
  rejected: '/providers/rejected',
  suspended: '/providers/suspended',
}

const getActiveTab = (path: string): AllProvidersTab =>
  (Object.entries(TAB_PATHS).find(([, p]) => p === path)?.[0] as AllProvidersTab) ??
  'pending-review'

const getTrustScoreColor = (score?: number | null) => {
  if (!score) return 'default'
  if (score >= 80) return 'success'
  if (score >= 50) return 'warning'
  return 'danger'
}

/**
 * Coloured-dot mapping for the OPERATIONAL column (BUG-107). Kept inline
 * rather than extracted to ui-web since SuperAdmin is the only consumer
 * today — promote when a second consumer appears.
 */
const OPERATIONAL_STATUS_DOT_CLASS: Record<OperationalStatus, string> = {
  [OperationalStatus.FullyActive]: 'bg-success',
  [OperationalStatus.SetupIncomplete]: 'bg-warning',
  [OperationalStatus.ActionRequired]: 'bg-danger',
  [OperationalStatus.Inactive]: 'bg-default-400',
}

// `timeZoneName: 'short'` appends "BST" / "GMT" / "GMT+1" etc so the
// SuperAdmin always knows which zone they're looking at — uses the
// browser's local zone (no override) so it matches the on-call's wall
// clock.
const LAST_LOGIN_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
})
const LAST_LOGIN_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
})

/**
 * Formats `lastLoginAt` for the operational-status tooltip. Renders the
 * SuperAdmin's local time so on-call ops see what they expect — no fixed
 * timezone override.
 *
 *   null                         → "Has never logged in"
 *   same calendar day as today   → "Last login: today at 14:32"
 *   any other day                → "Last login: 15 Mar 2026, 14:32 (12 days ago)"
 */
function formatLastLogin(iso: string | null): string {
  if (iso == null) return 'Has never logged in'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Has never logged in'

  const now = new Date()
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isSameDay) {
    return `Last login: Today at ${LAST_LOGIN_TIME_FORMATTER.format(date)}`
  }

  // Whole-day difference based on calendar dates, not 24h windows — so
  // "logged in yesterday at 23:50" reads as "1 day ago", not "<1 day ago".
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfLogin = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((startOfToday.getTime() - startOfLogin.getTime()) / 86_400_000)
  const relative = days === 1 ? '1 day ago' : `${days} days ago`

  return `Last login: ${LAST_LOGIN_FORMATTER.format(date)} (${relative})`
}

/**
 * Tooltip body rendered when the SuperAdmin hovers a provider's operational
 * dot. Lists the underlying conditions (Stripe / camps / sessions / payouts
 * / activity) using ✓ / ✗ markers driven entirely by the API response.
 */
function OperationalStatusReasonsList({ reasons }: { reasons: OperationalStatusReasons }) {
  const items: Array<{ ok: boolean; label: string }> = [
    {
      ok: reasons.stripeConnected,
      label: reasons.stripeConnected ? 'Stripe connected' : 'Stripe not connected',
    },
    {
      ok: reasons.publishedCampCount > 0,
      label:
        reasons.publishedCampCount > 0
          ? `${reasons.publishedCampCount} published camp${reasons.publishedCampCount === 1 ? '' : 's'}`
          : 'No published camps',
    },
    {
      ok: reasons.publishedSessionCount > 0,
      label:
        reasons.publishedSessionCount > 0
          ? `${reasons.publishedSessionCount} published session${reasons.publishedSessionCount === 1 ? '' : 's'}`
          : 'No published sessions',
    },
    {
      // "ok" here means "no failure" — invert the boolean.
      ok: !reasons.hasRecentFailedPayout,
      label: reasons.hasRecentFailedPayout
        ? 'Failed payout in last 90 days'
        : 'No recent failed payouts',
    },
  ]

  return (
    <div className="min-w-56 text-xs">
      <p className="mb-2 font-semibold text-foreground">Operational checks</p>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item.label} className="flex items-start gap-2">
            <span aria-hidden="true" className={item.ok ? 'text-success' : 'text-danger'}>
              {item.ok ? '✓' : '✗'}
            </span>
            <span className="text-default-700">{item.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-default-200 pt-2 text-default-500">
        {formatLastLogin(reasons.lastLoginAt)}
      </p>
    </div>
  )
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

export function AllProvidersView() {
  const router = useRouter()
  const pathname = usePathname()
  const {
    applications,
    pagination,
    filters,
    tabCounts,
    isLoading,
    fetchApplications,
    fetchTabCounts,
    approveApplication,
    setPage,
    setFilters,
    clearFilters,
  } = useApplicationReviewStore()

  const { confirm } = useConfirmDialog()

  const activeTab = getActiveTab(pathname)
  const [searchInput, setSearchInput] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)
  const hasInitialized = useRef(false)

  const debouncedSearch = useDebounce(searchInput, 500)

  // Initial load — set status filter based on the current tab path
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      clearFilters()
      setFilters({ status: TAB_STATUS_MAP[activeTab] })
      void fetchTabCounts()
      void fetchApplications()
    }
  }, [])

  // Update search filter when debounced value changes
  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
  }, [debouncedSearch, setFilters])

  // Re-fetch when filters or pagination change
  useEffect(() => {
    void fetchApplications()
  }, [fetchApplications, pagination.page, pagination.limit, filters])

  const handleTabChange = (key: React.Key) => {
    router.push(TAB_PATHS[key as AllProvidersTab])
  }

  const handleClearFilters = () => {
    setSearchInput('')
    clearFilters()
    setFilters({ status: TAB_STATUS_MAP[activeTab] })
  }

  const hasActiveFilters = searchInput !== ''

  const handleImpersonate = async (app: ApplicationListItem) => {
    setImpersonatingId(app.id)
    try {
      const result = await providersService.impersonateProvider(app.id)
      window.open(`${config.app.providerAppUrl}/auth/impersonate?token=${result.token}`, '_blank')
    } catch {
      addToast({
        title: 'Could not open provider session',
        description: 'Please try again.',
        color: 'danger',
      })
    } finally {
      setImpersonatingId(null)
    }
  }

  const handleQuickApprove = async (app: ApplicationListItem) => {
    const confirmed = await confirm({
      title: 'Approve Provider?',
      message: `Are you sure you want to approve "${app.businessName}"? They will gain full provider access.`,
      confirmText: 'Approve',
      cancelText: 'Cancel',
      variant: 'warning',
    })
    if (!confirmed) return

    setApprovingId(app.id)
    try {
      await approveApplication(app.id, {})
      addToast({
        title: `${app.businessName} approved`,
        color: 'success',
      })
      void fetchTabCounts()
      void fetchApplications()
    } catch {
      addToast({
        title: 'Approval failed',
        description: 'Please try again from the detail page.',
        color: 'danger',
      })
    } finally {
      setApprovingId(null)
    }
  }

  const tabCountBadge = (count: number, warning?: boolean) =>
    count > 0 ? (
      <Chip size="sm" color={warning ? 'warning' : 'default'}>
        {count}
      </Chip>
    ) : null

  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">All Providers</h1>
            <p className="mt-1 text-default-600">Manage camp providers and their applications</p>
          </div>
        </header>
        <Card>
          <CardBody className="p-0">
            {/* Tabs */}
            <div className="flex border-b border-default-200 px-4 pt-3">
              <Tabs
                aria-label="Provider categories"
                selectedKey={activeTab}
                onSelectionChange={handleTabChange}
                variant="underlined"
                classNames={{
                  base: 'w-full',
                  tabList: 'p-0!',
                }}
              >
                <Tab
                  key="pending-review"
                  title={
                    <span className="flex items-center gap-1.5">
                      Pending Review {tabCountBadge(tabCounts.pendingReview, true)}
                    </span>
                  }
                />
                <Tab
                  key="approved"
                  title={
                    <span className="flex items-center gap-1.5">
                      Approved {tabCountBadge(tabCounts.approved)}
                    </span>
                  }
                />
                <Tab
                  key="rejected"
                  title={
                    <span className="flex items-center gap-1.5">
                      Rejected {tabCountBadge(tabCounts.rejected)}
                    </span>
                  }
                />
                <Tab
                  key="suspended"
                  title={
                    <span className="flex items-center gap-1.5">
                      Suspended {tabCountBadge(tabCounts.suspended)}
                    </span>
                  }
                />
              </Tabs>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-default-200 px-4 py-3">
              <Input
                aria-label="Search providers"
                placeholder="Search by business name, email, or legal name…"
                className="w-full max-w-sm shrink-0"
                value={searchInput}
                onValueChange={setSearchInput}
                isClearable
                onClear={() => setSearchInput('')}
                startContent={<Search className="size-4 shrink-0 text-default-500" aria-hidden />}
              />
              {hasActiveFilters && (
                <Button
                  variant="flat"
                  className="shrink-0"
                  startContent={<FilterX className="h-4 w-4" />}
                  onPress={handleClearFilters}
                >
                  Clear filters
                </Button>
              )}
              <Button
                variant="flat"
                color="primary"
                className="ml-auto shrink-0"
                startContent={<Upload className="h-4 w-4" />}
                onPress={() => router.push('/providers/import')}
              >
                Import Providers
              </Button>
            </div>

            {/* Table */}
            <Table
              aria-label="All providers table"
              classNames={{ wrapper: 'shadow-none rounded-none' }}
              bottomContent={
                pagination.total > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <span className="text-sm text-default-500">
                      Showing {applications.length} of {pagination.total} providers
                    </span>
                    {pagination.totalPages > 1 ? (
                      <Pagination
                        total={pagination.totalPages}
                        page={pagination.page}
                        onChange={setPage}
                        showControls
                      />
                    ) : null}
                  </div>
                ) : undefined
              }
            >
              <TableHeader>
                <TableColumn>PROVIDER</TableColumn>
                <TableColumn>OPERATIONAL</TableColumn>
                <TableColumn>TRUST SCORE</TableColumn>
                <TableColumn>JOINED</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody
                items={applications}
                isLoading={isLoading}
                emptyContent={
                  <div className="py-12 text-center">
                    <p className="text-default-500">
                      {isLoading ? 'Loading…' : 'No providers found.'}
                    </p>
                  </div>
                }
              >
                {app => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {app.logoUrl ? (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-default-200 bg-white overflow-hidden">
                            <img
                              src={app.logoUrl}
                              alt="Provider logo"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center shrink-0">
                            <span className="text-white text-sm font-semibold">
                              {getInitials(app.businessName)}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{app.businessName}</div>
                          {app.legalCompanyName && (
                            <div className="text-xs text-default-500">{app.legalCompanyName}</div>
                          )}
                          <div className="text-xs text-default-400">{app.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.operationalStatus && app.operationalStatusReasons ? (
                        <Tooltip
                          placement="top"
                          content={
                            <OperationalStatusReasonsList reasons={app.operationalStatusReasons} />
                          }
                          classNames={{ content: 'p-3' }}
                        >
                          <div
                            tabIndex={0}
                            className="flex w-fit cursor-help items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-default-300 rounded"
                          >
                            <span
                              aria-hidden="true"
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${OPERATIONAL_STATUS_DOT_CLASS[app.operationalStatus]}`}
                            />
                            <span className="text-sm text-default-700">
                              {OPERATIONAL_STATUS_LABELS[app.operationalStatus]}
                            </span>
                          </div>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-default-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {app.trustScore !== null && app.trustScore !== undefined ? (
                        <Chip size="sm" color={getTrustScoreColor(app.trustScore)} variant="flat">
                          {app.trustScore}/100
                        </Chip>
                      ) : (
                        <span className="text-sm text-default-400">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-default-500">{formatDate(app.createdAt)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          aria-label="View provider"
                          onPress={() =>
                            router.push(
                              activeTab === 'pending-review'
                                ? `/providers/pending-review/${app.id}`
                                : `/providers/${app.id}`
                            )
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {app.approvalStatus === 'approved' && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="primary"
                            aria-label="Login as provider"
                            isLoading={impersonatingId === app.id}
                            onPress={() => void handleImpersonate(app)}
                          >
                            <LogIn className="h-4 w-4 text-primary-600" />
                          </Button>
                        )}
                        {activeTab === 'pending-review' && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="success"
                            aria-label="Quick approve"
                            isLoading={approvingId === app.id}
                            onPress={() => void handleQuickApprove(app)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </section>
    </PageSlot>
  )
}
