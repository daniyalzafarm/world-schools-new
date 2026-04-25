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
} from '@heroui/react'
import { Check, Eye, FilterX, LogIn, Search, Upload } from 'lucide-react'
import { Input, useDebounce } from '@world-schools/ui-web'
import { PageSlot } from '@/components/layout/page-slot'
import { useApplicationReviewStore } from '@/stores/application-review-store'
import { providersService } from '@/services/providers.services'
import config from '@/config/config'
import type { ApplicationListItem, ApprovalStatus } from '@/types/application-review'

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

const getStatusColor = (status: ApprovalStatus) => {
  switch (status) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'under_review':
      return 'primary'
    case 'info_requested':
      return 'warning'
    case 'suspended':
      return 'default'
    default:
      return 'warning'
  }
}

const getStatusLabel = (status: ApprovalStatus) => {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'under_review':
      return 'Pending Review'
    case 'info_requested':
      return 'Info Requested'
    case 'suspended':
      return 'Suspended'
    default:
      return 'Pending'
  }
}

const getTrustScoreColor = (score?: number | null) => {
  if (!score) return 'default'
  if (score >= 80) return 'success'
  if (score >= 50) return 'warning'
  return 'danger'
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

const getInitials = (name: string | null | undefined) => {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

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
                <TableColumn>STATUS</TableColumn>
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
                      <Chip size="sm" color={getStatusColor(app.approvalStatus)} variant="flat">
                        {getStatusLabel(app.approvalStatus)}
                      </Chip>
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
